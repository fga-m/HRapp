import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/places/autocomplete?q=... — address suggestions from OpenStreetMap
// (Nominatim). Proxied server-side so we can send the required identifying
// User-Agent and comply with their usage policy. Signed-in staff only.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 3) return NextResponse.json({ results: [] });

  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=0&q=" +
      encodeURIComponent(q);
    const res = await fetch(url, {
      headers: {
        // Nominatim's usage policy requires an identifying User-Agent.
        "User-Agent": "FGAM-HR-Portal/1.0 (hrapp@fgam.org.au)",
        "Accept-Language": "en",
      },
      // Cache identical lookups briefly to ease load and speed up repeats.
      next: { revalidate: 60 },
    });
    if (!res.ok) return NextResponse.json({ results: [] });
    const data = await res.json();
    const results = (Array.isArray(data) ? data : [])
      .map((d: { display_name?: string }) => ({ label: d.display_name ?? "" }))
      .filter((r: { label: string }) => r.label);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
