import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = (session as any).accessToken;
  if (!token) return NextResponse.json({ error: "No access token — please sign out and sign back in" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const calendarId = searchParams.get("calendarId") || "primary";
  const timeMin = searchParams.get("timeMin") || new Date().toISOString();
  const timeMax = searchParams.get("timeMax") || new Date(Date.now() + 7 * 86400000).toISOString();

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  );
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.error?.message || "Failed to fetch calendar";
    // 401 = token expired, 403 = no access to that calendar
    return NextResponse.json({ error: message }, { status: res.status });
  }

  const body = await res.json();
  return NextResponse.json(body.items || []);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = (session as any).accessToken;
  if (!token) return NextResponse.json({ error: "No access token" }, { status: 401 });

  const { calendarId, ...body } = await req.json();
  const calId = calendarId || "primary";

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data?.error?.message || "Failed to create event" }, { status: res.status });
  return NextResponse.json(data, { status: 201 });
}
