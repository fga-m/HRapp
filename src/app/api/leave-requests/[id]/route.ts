import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import { xeroRequest } from "@/lib/xero";
import { getGoogleTokensByStaffId, saveGoogleTokensByStaffId } from "@/lib/google-tokens";
import { sendEmail } from "@/lib/google-mail";
import { getEmailTemplate, renderTemplate } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

function toXeroDate(dateStr: string): string {
  const ms = new Date(dateStr).getTime();
  return `/Date(${ms}+0000)/`;
}

// PATCH /api/leave-requests/[id] — approve or reject a pending request
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("id, role")
    .eq("email", session.user?.email ?? "")
    .single();

  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isReviewer = caller.role === "admin" || caller.role === "leave_approver";
  if (!isReviewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action, note } = await req.json() as {
    action: "APPROVE" | "REJECT";
    note?: string;
  };

  if (action !== "APPROVE" && action !== "REJECT") {
    return NextResponse.json({ error: "action must be APPROVE or REJECT" }, { status: 400 });
  }

  // Fetch the request
  const { data: leaveReq, error: fetchErr } = await supabaseAdmin
    .from("leave_requests")
    .select("*")
    .eq("id", id)
    .eq("status", "PENDING")
    .single();

  if (fetchErr || !leaveReq) {
    return NextResponse.json({ error: "Request not found or already reviewed" }, { status: 404 });
  }

  // A person can't review their own leave request — same rule as expense claims.
  if (caller.id === leaveReq.staff_id) {
    return NextResponse.json(
      { error: "You can't approve or decline your own leave request." },
      { status: 403 }
    );
  }

  if (action === "REJECT") {
    const { error } = await supabaseAdmin
      .from("leave_requests")
      .update({
        status: "REJECTED",
        approver_id: caller.id,
        approver_note: note?.trim() || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await createNotification({
      staff_id: leaveReq.staff_id,
      title: "Leave request declined",
      message: `Your ${leaveReq.leave_type_name} request from ${leaveReq.start_date} to ${leaveReq.end_date} was not approved${note?.trim() ? `: "${note.trim()}"` : "."}`,
      type: "leave",
      link: "/dashboard/leave",
      is_read: false,
    });

    // Best-effort: email the requester using the (editable) decline template.
    // Never blocks the decline if email isn't connected or sending fails.
    try {
      const { data: requester } = await supabaseAdmin
        .from("staff")
        .select("email, full_name, first_name")
        .eq("id", leaveReq.staff_id)
        .single();

      if (requester?.email) {
        const fmt = (d: string) =>
          new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
        const period =
          leaveReq.start_date === leaveReq.end_date
            ? fmt(leaveReq.start_date)
            : `${fmt(leaveReq.start_date)} to ${fmt(leaveReq.end_date)}`;
        const vars: Record<string, string> = {
          name: requester.first_name || requester.full_name || "there",
          leave_type: leaveReq.leave_type_name ?? "Leave",
          description: leaveReq.description?.trim() || period,
          period,
          hours: leaveReq.hours != null ? `${leaveReq.hours} hours` : "Auto-calculated in Xero",
          reason: note?.trim() || "No reason was provided.",
          app_url: process.env.NEXTAUTH_URL ?? "",
        };
        const tpl = await getEmailTemplate("decline");
        await sendEmail({
          to: requester.email,
          subject: renderTemplate(tpl.subject, vars),
          html: renderTemplate(tpl.html, vars),
          fromName: tpl.fromName,
          replyTo: tpl.replyTo || undefined,
        });
      }
    } catch (err) {
      console.error("[leave-decline] email send failed (non-fatal):", err);
    }

    return NextResponse.json({ status: "REJECTED" });
  }

  // APPROVE — look up staff member's Xero employee ID and submit to Xero
  const { data: member } = await supabaseAdmin
    .from("staff")
    .select("xero_employee_id")
    .eq("id", leaveReq.staff_id)
    .single();

  if (!member?.xero_employee_id) {
    return NextResponse.json(
      { error: "Staff member is not linked to Xero Payroll. Link them first in their staff profile." },
      { status: 400 }
    );
  }

  try {
    // Xero's AU Payroll LeaveApplications POST expects a bare JSON ARRAY of
    // applications — NOT an object wrapped in { LeaveApplications: [...] }
    // (that returns "Cannot deserialize the current JSON object ... into type
    // ... because [it expects an array]"). Title is REQUIRED (max 50 chars);
    // units are omitted so Xero auto-calculates them from the pay calendar.
    const body = [
      {
        EmployeeID: member.xero_employee_id,
        LeaveTypeID: leaveReq.leave_type_id,
        Title: (leaveReq.leave_type_name || "Leave").slice(0, 50),
        StartDate: toXeroDate(leaveReq.start_date),
        EndDate: toXeroDate(leaveReq.end_date),
        ...(leaveReq.description ? { Description: leaveReq.description } : {}),
      },
    ];

    const res = await xeroRequest("/payroll.xro/1.0/LeaveApplications", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Read Xero's error robustly — Payroll AU nests validation messages and
      // sometimes returns non-JSON, so fall back through several shapes rather
      // than reporting a useless "Unknown error".
      const raw = await res.text().catch(() => "");
      let msg = "";
      try {
        const j = JSON.parse(raw);
        const vErrs: string[] = [];
        const collect = (arr: unknown) => {
          if (Array.isArray(arr)) for (const v of arr) if (v?.Message) vErrs.push(v.Message);
        };
        collect(j?.ValidationErrors);
        if (Array.isArray(j?.Elements)) for (const el of j.Elements) collect(el?.ValidationErrors);
        msg = vErrs.join("; ") || j?.Message || j?.Detail || j?.message || "";
      } catch {
        /* response body wasn't JSON */
      }
      return NextResponse.json(
        { error: msg || raw.slice(0, 300) || `Xero rejected the leave application (HTTP ${res.status})` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const xeroId = data.LeaveApplications?.[0]?.LeaveApplicationID ?? null;

    // Mark as approved in DB
    const { error: updateErr } = await supabaseAdmin
      .from("leave_requests")
      .update({
        status: "APPROVED",
        approver_id: caller.id,
        approver_note: note?.trim() || null,
        xero_leave_application_id: xeroId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    await createNotification({
      staff_id: leaveReq.staff_id,
      title: "Leave request approved",
      message: `Your ${leaveReq.leave_type_name} request from ${leaveReq.start_date} to ${leaveReq.end_date} has been approved.`,
      type: "leave",
      link: "/dashboard/leave",
      is_read: false,
    });

    // Best-effort: email the requester that their leave was approved (uses the
    // editable approval template). Never blocks the approval.
    try {
      const { data: requester } = await supabaseAdmin
        .from("staff")
        .select("email, full_name, first_name")
        .eq("id", leaveReq.staff_id)
        .single();

      if (requester?.email) {
        const fmt = (d: string) =>
          new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
        const period =
          leaveReq.start_date === leaveReq.end_date
            ? fmt(leaveReq.start_date)
            : `${fmt(leaveReq.start_date)} to ${fmt(leaveReq.end_date)}`;

        // Best-effort: read the up-to-date balance for this leave type from Xero
        // so the email can show what they have left. Never blocks the email.
        let balanceStr = "";
        try {
          const balRes = await xeroRequest(
            `/payroll.xro/1.0/Employees/${member.xero_employee_id}`
          );
          if (balRes.ok) {
            const balJson = await balRes.json();
            const bal = (balJson.Employees?.[0]?.LeaveBalances ?? []).find(
              (b: any) => b.LeaveTypeID === leaveReq.leave_type_id
            );
            if (bal && bal.NumberOfUnits != null) {
              const units = Math.round(Number(bal.NumberOfUnits) * 100) / 100;
              balanceStr = `${units} ${bal.TypeOfUnits || "hours"}`;
            }
          }
        } catch {
          /* balance is best-effort */
        }

        const vars: Record<string, string> = {
          name: requester.first_name || requester.full_name || "there",
          leave_type: leaveReq.leave_type_name ?? "Leave",
          description: leaveReq.description?.trim() || period,
          period,
          hours: leaveReq.hours != null ? `${leaveReq.hours} hours` : "Auto-calculated in Xero",
          balance: balanceStr || "see the HR Portal",
          reason: note?.trim() || "",
          app_url: process.env.NEXTAUTH_URL ?? "",
        };
        const tpl = await getEmailTemplate("approve");
        await sendEmail({
          to: requester.email,
          subject: renderTemplate(tpl.subject, vars),
          html: renderTemplate(tpl.html, vars),
          fromName: tpl.fromName,
          replyTo: tpl.replyTo || undefined,
        });
      }
    } catch (err) {
      console.error("[leave-approve] email send failed (non-fatal):", err);
    }

    // Auto-create an all-day calendar event using the staff member's own Google account.
    // All-day events are excluded from TOIL hour calculations (TOIL only sums timed events).
    // Leave hours are separately added to TOIL via the approved-leave adjustment.
    try {
      const { data: staffRecord } = await supabaseAdmin
        .from("staff")
        .select("email, full_name")
        .eq("id", leaveReq.staff_id)
        .single();

      const tokens = await getGoogleTokensByStaffId(leaveReq.staff_id);
      let calToken = tokens?.access_token ?? null;

      // Refresh the token if expired or nearly expired
      if (calToken && tokens?.token_expires_at) {
        const expiresAt = new Date(tokens.token_expires_at).getTime();
        if (Date.now() > expiresAt - 60_000 && tokens.refresh_token) {
          const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: "refresh_token",
              refresh_token: tokens.refresh_token,
            }),
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            calToken = refreshData.access_token;
            // Persist the refreshed token to the dedicated tokens table
            await saveGoogleTokensByStaffId(
              leaveReq.staff_id,
              refreshData.access_token,
              refreshData.refresh_token ?? undefined,
              Date.now() + refreshData.expires_in * 1000
            );
          }
        }
      }

      if (calToken && staffRecord?.email) {
        // Google Calendar all-day events use exclusive end dates (end = day after last day)
        const endExclusive = new Date(leaveReq.end_date);
        endExclusive.setDate(endExclusive.getDate() + 1);
        const endDateStr = endExclusive.toISOString().split("T")[0];

        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(staffRecord.email)}/events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${calToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              summary: leaveReq.leave_type_name,
              description: "Approved leave",
              start: { date: leaveReq.start_date },
              end: { date: endDateStr },
              transparency: "opaque",
              status: "confirmed",
            }),
          }
        );
      }
    } catch {
      // Calendar event creation is best-effort — never blocks the approval
    }

    return NextResponse.json({ status: "APPROVED", xeroId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
