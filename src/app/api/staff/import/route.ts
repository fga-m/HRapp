import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET — fetch all Google Workspace users for selection
export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check caller is admin
  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("role")
    .eq("email", session.user?.email)
    .single();

  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  try {
    const res = await fetch(
      "https://admin.googleapis.com/admin/directory/v1/users?domain=fgam.org.au&maxResults=100&orderBy=givenName",
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json(
        { error: err.error?.message || "Failed to fetch Google users" },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Get already-imported emails so we can mark them
    const { data: existingStaff } = await supabaseAdmin
      .from("staff")
      .select("email");

    const existingEmails = new Set(existingStaff?.map((s: any) => s.email) || []);

    const users = (data.users || []).map((u: any) => ({
      email: u.primaryEmail,
      full_name: u.name?.fullName || `${u.name?.givenName} ${u.name?.familyName}`,
      avatar_url: u.thumbnailPhotoUrl || null,
      already_imported: existingEmails.has(u.primaryEmail),
    }));

    return NextResponse.json(users);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — import selected users into the staff table
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("role")
    .eq("email", session.user?.email)
    .single();

  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await req.json();
  const { users } = body; // array of { email, full_name, avatar_url }

  if (!users?.length) {
    return NextResponse.json({ error: "No users provided" }, { status: 400 });
  }

  const toInsert = users.map((u: any) => ({
    email: u.email,
    full_name: u.full_name,
    avatar_url: u.avatar_url || null,
    google_calendar_id: u.email,
    role: "staff",
  }));

  const { data, error } = await supabaseAdmin
    .from("staff")
    .upsert(toInsert, { onConflict: "email", ignoreDuplicates: true })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ imported: data?.length || 0 });
}
