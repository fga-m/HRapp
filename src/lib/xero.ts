import { supabaseAdmin } from "@/lib/supabase";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

function basicAuth() {
  const credentials = `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`;
  return Buffer.from(credentials).toString("base64");
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  }>;
}

export async function refreshXeroToken(refreshToken: string) {
  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

export async function getXeroTenants(accessToken: string) {
  const res = await fetch(XERO_CONNECTIONS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error("Failed to fetch Xero tenants");
  return res.json() as Promise<
    Array<{ id: string; tenantId: string; tenantType: string; tenantName: string }>
  >;
}

/** Returns a valid access token, refreshing if needed. Throws if not connected. */
export async function getValidXeroToken(): Promise<{ accessToken: string; tenantId: string }> {
  const { data: conn, error } = await supabaseAdmin
    .from("xero_connection")
    .select("*")
    .order("connected_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !conn) throw new Error("Xero not connected");

  // If token expires in more than 5 minutes, use it as-is
  const expiresAt = new Date(conn.expires_at).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return { accessToken: conn.access_token, tenantId: conn.tenant_id };
  }

  // Refresh
  const tokens = await refreshXeroToken(conn.refresh_token);
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabaseAdmin
    .from("xero_connection")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  return { accessToken: tokens.access_token, tenantId: conn.tenant_id };
}

/** Make an authenticated request to the Xero API */
export async function xeroRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const { accessToken, tenantId } = await getValidXeroToken();
  const doFetch = () =>
    fetch(`https://api.xero.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Xero-Tenant-Id": tenantId,
        "Content-Type": "application/json",
        Accept: "application/json",
        // Caller headers spread last so they may override the defaults above
        // (e.g. attachment uploads need their own Content-Type).
        ...(options.headers ?? {}),
      },
    });

  let res = await doFetch();

  // Light rate-limit handling: honour Retry-After once on a 429.
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After"));
    if (Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 60) {
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      res = await doFetch();
    }
  }

  return res;
}

// ---------------------------------------------------------------------------
// Expense-claim (ACCPAY bill) helpers
// ---------------------------------------------------------------------------

const ACCOUNTING = "/api.xro/2.0";

/** Read the body of a failed Xero response into a useful error message. */
async function xeroErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null as any);
  if (body) {
    // Top-level / nested validation errors (Invoices, Contacts, etc.)
    const el = body.Elements?.[0];
    const validationMessages: string[] = [];
    if (Array.isArray(el?.ValidationErrors)) {
      for (const v of el.ValidationErrors) if (v?.Message) validationMessages.push(v.Message);
    }
    if (Array.isArray(el?.LineItems)) {
      for (const li of el.LineItems) {
        if (Array.isArray(li?.ValidationErrors)) {
          for (const v of li.ValidationErrors) if (v?.Message) validationMessages.push(v.Message);
        }
      }
    }
    if (validationMessages.length) return validationMessages.join("; ");
    if (body.Message) return body.Message;
    if (body.Detail) return body.Detail;
  }
  const text = await res.text().catch(() => "");
  return text || fallback;
}

/**
 * List active expense / overhead accounts (with their default tax type) so the
 * UI can present account-code choices.
 */
export async function listExpenseAccounts(): Promise<
  { code: string; name: string; taxType: string }[]
> {
  const where = encodeURIComponent(
    'Status=="ACTIVE" AND (Class=="EXPENSE" OR Class=="OVERHEADS")'
  );
  const res = await xeroRequest(`${ACCOUNTING}/Accounts?where=${where}`);
  if (!res.ok) throw new Error(await xeroErrorMessage(res, "Failed to load Xero accounts"));
  const data = await res.json();
  return (data.Accounts ?? [])
    // Exclude codes ending in "00" — those are ministry "header" accounts, not postable.
    .filter((a: any) => a.Code && !String(a.Code).endsWith("00"))
    .map((a: any) => ({
      code: String(a.Code),
      name: String(a.Name ?? ""),
      taxType: String(a.TaxType ?? ""),
    }));
}

/** List active tax rates that can be applied to expenses. */
export async function listTaxRates(): Promise<
  { taxType: string; name: string; rate: number }[]
> {
  const res = await xeroRequest(`${ACCOUNTING}/TaxRates`);
  if (!res.ok) throw new Error(await xeroErrorMessage(res, "Failed to load Xero tax rates"));
  const data = await res.json();
  // Expense claims only use two rates: GST on Expenses (default) and GST Free Expenses.
  const allowed = ["gst on expenses", "gst free expenses"];
  return (data.TaxRates ?? [])
    .filter((t: any) => t.Status === "ACTIVE" && allowed.includes(String(t.Name ?? "").toLowerCase()))
    .map((t: any) => ({
      taxType: String(t.TaxType ?? ""),
      name: String(t.Name ?? ""),
      rate: Number(t.EffectiveRate ?? t.DisplayTaxRate ?? 0),
    }));
}

/**
 * Find (or create) the Xero contact representing a staff member. Matches first
 * by AccountNumber == staff.id, then by EmailAddress, otherwise creates a new
 * contact carrying the staff id as its AccountNumber. Returns the ContactID.
 */
export async function findOrCreateContact(staff: {
  id: string;
  full_name: string;
  email?: string | null;
}): Promise<string> {
  // 1. Match by AccountNumber == staff.id
  const byAccount = encodeURIComponent(`AccountNumber=="${staff.id}"`);
  const accRes = await xeroRequest(`${ACCOUNTING}/Contacts?where=${byAccount}`);
  if (accRes.ok) {
    const data = await accRes.json();
    const match = (data.Contacts ?? [])[0];
    if (match?.ContactID) return String(match.ContactID);
  }

  // 2. Match by EmailAddress
  if (staff.email) {
    const byEmail = encodeURIComponent(`EmailAddress=="${staff.email}"`);
    const emailRes = await xeroRequest(`${ACCOUNTING}/Contacts?where=${byEmail}`);
    if (emailRes.ok) {
      const data = await emailRes.json();
      const match = (data.Contacts ?? [])[0];
      if (match?.ContactID) {
        // Backfill the AccountNumber so future lookups match on id. Best effort.
        try {
          await xeroRequest(`${ACCOUNTING}/Contacts`, {
            method: "POST",
            body: JSON.stringify({
              Contacts: [{ ContactID: match.ContactID, AccountNumber: staff.id }],
            }),
          });
        } catch {
          /* non-fatal */
        }
        return String(match.ContactID);
      }
    }
  }

  // 3. Create a new contact.
  const createRes = await xeroRequest(`${ACCOUNTING}/Contacts`, {
    method: "POST",
    body: JSON.stringify({
      Contacts: [
        {
          Name: staff.full_name,
          AccountNumber: staff.id,
          ...(staff.email ? { EmailAddress: staff.email } : {}),
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const msg = await xeroErrorMessage(createRes, "Failed to create Xero contact");
    // Xero rejects duplicate contact names (often because the contact is
    // archived). Try to find and unarchive it.
    if (/already exists|archived/i.test(msg)) {
      const byName = encodeURIComponent(`Name=="${staff.full_name}"`);
      const nameRes = await xeroRequest(
        `${ACCOUNTING}/Contacts?where=${byName}&includeArchived=true`
      );
      if (nameRes.ok) {
        const data = await nameRes.json();
        const match = (data.Contacts ?? [])[0];
        if (match?.ContactID) {
          // Restore + tag with the staff id. Best effort.
          try {
            await xeroRequest(`${ACCOUNTING}/Contacts`, {
              method: "POST",
              body: JSON.stringify({
                Contacts: [
                  {
                    ContactID: match.ContactID,
                    ContactStatus: "ACTIVE",
                    AccountNumber: staff.id,
                  },
                ],
              }),
            });
          } catch {
            /* non-fatal */
          }
          return String(match.ContactID);
        }
      }
    }
    throw new Error(msg);
  }

  const created = await createRes.json();
  const id = created.Contacts?.[0]?.ContactID;
  if (!id) throw new Error("Xero did not return a contact id");
  return String(id);
}

/**
 * Find an existing ACCPAY bill by its Reference (used for idempotency so a
 * claim is never pushed twice). Returns the InvoiceID or null.
 */
export async function findBillByReference(reference: string): Promise<string | null> {
  const where = encodeURIComponent(`Type=="ACCPAY" AND Reference=="${reference}"`);
  const res = await xeroRequest(`${ACCOUNTING}/Invoices?where=${where}`);
  if (!res.ok) throw new Error(await xeroErrorMessage(res, "Failed to query Xero bills"));
  const data = await res.json();
  const match = (data.Invoices ?? [])[0];
  return match?.InvoiceID ? String(match.InvoiceID) : null;
}

/**
 * Create an authorised ACCPAY (accounts-payable) bill in Xero.
 */
export async function createAccpayBill(args: {
  contactId: string;
  date: string; // yyyy-mm-dd
  dueDate?: string; // yyyy-mm-dd; ACCPAY bills REQUIRE a due date — defaults to the bill date
  // NOTE on Xero's two "reference" fields for ACCPAY (bills):
  //   • InvoiceNumber — what Xero SHOWS as "Reference" in the bill UI.
  //   • Reference     — a separate hidden "additional reference number".
  // So a human label (e.g. "Expense Claims") goes in `invoiceNumber`, while we
  // keep the unique claim id in `reference` purely for findBillByReference()
  // de-dup (it's queryable but not shown as the UI Reference).
  invoiceNumber?: string; // shows as "Reference" in the Xero bill UI
  reference?: string; // hidden additional reference — used for idempotency lookups
  lineItems: {
    Description: string;
    UnitAmount: number;
    AccountCode: string;
    TaxType?: string;
    Quantity?: number;
    // Manual GST override for this line. When set, Xero uses it instead of
    // computing tax from the rate (subject to Xero's own tolerance).
    TaxAmount?: number;
  }[];
  lineAmountTypes?: "Inclusive" | "Exclusive" | "NoTax";
}): Promise<{ invoiceId: string; invoiceNumber?: string; total: number; totalTax: number }> {
  const body = {
    Invoices: [
      {
        Type: "ACCPAY",
        Status: "AUTHORISED",
        Contact: { ContactID: args.contactId },
        Date: args.date,
        DueDate: args.dueDate ?? args.date, // required for ACCPAY (bills)
        LineAmountTypes: args.lineAmountTypes ?? "Inclusive",
        ...(args.invoiceNumber ? { InvoiceNumber: args.invoiceNumber } : {}),
        ...(args.reference ? { Reference: args.reference } : {}),
        LineItems: args.lineItems.map((li) => ({
          Description: li.Description,
          UnitAmount: li.UnitAmount,
          AccountCode: li.AccountCode,
          Quantity: li.Quantity ?? 1,
          ...(li.TaxType ? { TaxType: li.TaxType } : {}),
          ...(li.TaxAmount != null ? { TaxAmount: li.TaxAmount } : {}),
        })),
      },
    ],
  };

  const res = await xeroRequest(`${ACCOUNTING}/Invoices`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(await xeroErrorMessage(res, "Failed to create Xero bill"));

  const data = await res.json();
  const inv = data.Invoices?.[0];
  if (!inv?.InvoiceID) {
    throw new Error(await xeroErrorMessage(res, "Xero did not return a created bill"));
  }
  return {
    invoiceId: String(inv.InvoiceID),
    invoiceNumber: inv.InvoiceNumber ? String(inv.InvoiceNumber) : undefined,
    total: Number(inv.Total ?? 0),
    totalTax: Number(inv.TotalTax ?? 0),
  };
}

/**
 * Attach a receipt file to an existing bill. Best-effort: callers should wrap
 * this in their own try/catch. The filename in the URL must carry the correct
 * extension and the Content-Type must be the file's real mime type.
 */
export async function attachReceipt(
  invoiceId: string,
  fileName: string,
  bytes: Buffer,
  mime: string
): Promise<void> {
  // Copy into a fresh Uint8Array so the body is backed by a plain ArrayBuffer
  // (Buffer's generic ArrayBufferLike backing isn't a valid BodyInit in TS).
  const payload = new Uint8Array(bytes.byteLength);
  payload.set(bytes);
  const res = await xeroRequest(
    `${ACCOUNTING}/Invoices/${invoiceId}/Attachments/${encodeURIComponent(fileName)}`,
    {
      method: "PUT",
      // Overrides the default JSON Content-Type (caller headers spread last).
      headers: { "Content-Type": mime },
      body: payload,
    }
  );
  if (!res.ok) throw new Error(await xeroErrorMessage(res, "Failed to attach receipt to Xero bill"));
}

// ---------------------------------------------------------------------------
// Payroll (AU) employee helpers
// ---------------------------------------------------------------------------

const PAYROLL_AU = "/payroll.xro/1.0";

/** Pull a useful message out of a failed Payroll API response. The Payroll AU
 *  API nests validation errors differently from the accounting API. */
async function payrollErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null as any);
  if (body) {
    const messages: string[] = [];
    // Employee-level validation errors
    const emp = body.Employees?.[0];
    if (Array.isArray(emp?.ValidationErrors)) {
      for (const v of emp.ValidationErrors) if (v?.Message) messages.push(v.Message);
    }
    // Top-level validation errors
    if (Array.isArray(body.ValidationErrors)) {
      for (const v of body.ValidationErrors) if (v?.Message) messages.push(v.Message);
    }
    if (messages.length) return messages.join("; ");
    if (body.Message) return body.Message;
    if (body.Detail) return body.Detail;
    if (body.ProblemDetails?.Detail) return body.ProblemDetails.Detail;
  }
  const text = await res.text().catch(() => "");
  return text || `${fallback} (${res.status})`;
}

/** Xero Payroll AU wants ISO-ish datetimes; send midnight for date-only values. */
function payrollDate(yyyyMmDd: string): string {
  return `${yyyyMmDd}T00:00:00`;
}

export type PayrollEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
};

/** List all payroll employees (simplified). */
export async function listPayrollEmployees(): Promise<PayrollEmployee[]> {
  const res = await xeroRequest(`${PAYROLL_AU}/Employees`);
  if (!res.ok) throw new Error(await payrollErrorMessage(res, "Failed to load Xero employees"));
  const data = await res.json();
  return (data.Employees ?? []).map((e: any) => ({
    id: String(e.EmployeeID),
    firstName: String(e.FirstName ?? ""),
    lastName: String(e.LastName ?? ""),
    email: String(e.Email ?? ""),
    status: String(e.Status ?? ""),
  }));
}

/**
 * Find an existing payroll employee by email (case-insensitive), else by exact
 * first+last name. Used for idempotency so provisioning never creates a second
 * employee. Returns the EmployeeID or null. The AU Payroll Employees endpoint
 * doesn't support a reliable email filter, so we scan the (small) list.
 */
export async function findPayrollEmployee(args: {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<string | null> {
  const all = await listPayrollEmployees();
  const email = args.email?.trim().toLowerCase();
  if (email) {
    const byEmail = all.find((e) => e.email.trim().toLowerCase() === email);
    if (byEmail) return byEmail.id;
  }
  const fn = args.firstName?.trim().toLowerCase();
  const ln = args.lastName?.trim().toLowerCase();
  if (fn && ln) {
    const byName = all.find(
      (e) => e.firstName.trim().toLowerCase() === fn && e.lastName.trim().toLowerCase() === ln
    );
    if (byName) return byName.id;
  }
  return null;
}

export type CreatePayrollEmployeeArgs = {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // yyyy-mm-dd (required by Xero AU)
  email?: string | null;
  mobile?: string | null;
  phone?: string | null;
  startDate?: string | null; // yyyy-mm-dd
  title?: string | null; // JobTitle
  homeAddress: {
    addressLine1: string;
    addressLine2?: string | null;
    city: string; // suburb
    region: string; // AU state, e.g. VIC
    postalCode: string;
    country?: string | null; // defaults to AUSTRALIA
  };
};

/** Create a Xero Payroll (AU) employee. Returns the new EmployeeID. */
export async function createPayrollEmployee(
  args: CreatePayrollEmployeeArgs
): Promise<string> {
  const countryRaw = (args.homeAddress.country ?? "AU").trim().toUpperCase();
  const country = countryRaw === "AU" || countryRaw === "AUS" ? "AUSTRALIA" : countryRaw;

  const employee: Record<string, unknown> = {
    FirstName: args.firstName,
    LastName: args.lastName,
    DateOfBirth: payrollDate(args.dateOfBirth),
    ...(args.email ? { Email: args.email } : {}),
    ...(args.mobile ? { Mobile: args.mobile } : {}),
    ...(args.phone ? { Phone: args.phone } : {}),
    ...(args.startDate ? { StartDate: payrollDate(args.startDate) } : {}),
    ...(args.title ? { Title: args.title } : {}),
    HomeAddress: {
      AddressLine1: args.homeAddress.addressLine1,
      ...(args.homeAddress.addressLine2 ? { AddressLine2: args.homeAddress.addressLine2 } : {}),
      City: args.homeAddress.city,
      Region: args.homeAddress.region,
      PostalCode: args.homeAddress.postalCode,
      Country: country,
    },
  };

  const res = await xeroRequest(`${PAYROLL_AU}/Employees`, {
    method: "POST",
    body: JSON.stringify({ Employees: [employee] }),
  });
  if (!res.ok) throw new Error(await payrollErrorMessage(res, "Failed to create Xero employee"));

  const data = await res.json();
  const id = data.Employees?.[0]?.EmployeeID;
  if (!id) throw new Error(await payrollErrorMessage(res, "Xero did not return a created employee"));
  return String(id);
}

/**
 * Idempotent: returns an existing payroll employee's id if one already matches
 * (by email or name), otherwise creates a new one. The boolean `created` tells
 * the caller whether a new record was made.
 */
export async function findOrCreatePayrollEmployee(
  args: CreatePayrollEmployeeArgs
): Promise<{ employeeId: string; created: boolean }> {
  const existing = await findPayrollEmployee({
    email: args.email,
    firstName: args.firstName,
    lastName: args.lastName,
  });
  if (existing) return { employeeId: existing, created: false };
  const employeeId = await createPayrollEmployee(args);
  return { employeeId, created: true };
}
