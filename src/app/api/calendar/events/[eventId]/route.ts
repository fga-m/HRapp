import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = (session as any).accessToken;
  if (!token) return NextResponse.json({ error: "No access token" }, { status: 401 });

  const { eventId } = await params;
  const { calendarId, ...body } = await req.json();
  const calId = calendarId || "primary";

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data?.error?.message || "Failed to update event" }, { status: res.status });
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = (session as any).accessToken;
  if (!token) return NextResponse.json({ error: "No access token" }, { status: 401 });

  const { eventId } = await params;
  const { searchParams } = new URL(req.url);
  const calId = searchParams.get("calendarId") || "primary";

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (res.status === 204) return NextResponse.json({ ok: true });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ error: data?.error?.message || "Failed to delete event" }, { status: res.status });
}
