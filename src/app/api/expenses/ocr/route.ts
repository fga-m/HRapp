import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/caller";

export const dynamic = "force-dynamic";

// Claude models used to read receipts.
//  - PDFs usually contain real text, so the fast/cheap Haiku model reads them
//    near-perfectly.
//  - Photos (JPEG/PNG) are downscaled by the vision API and rely on visual OCR,
//    so a stronger model reads dense/small receipt text much more reliably.
const OCR_MODEL = process.env.ANTHROPIC_OCR_MODEL || "claude-haiku-4-5-20251001";
const OCR_IMAGE_MODEL = process.env.ANTHROPIC_OCR_IMAGE_MODEL || "claude-sonnet-4-6";
const ALLOWED = ["image/png", "image/jpeg", "application/pdf"];

interface OcrLineItem {
  description: string;
  amount: number;        // GST-inclusive line total
  gst: number | null;
}

interface OcrResult {
  amount: number | null;
  date: string | null;   // YYYY-MM-DD
  vendor: string | null;
  gst: number | null;
  items: OcrLineItem[];
}

const PROMPT = `You are extracting fields from a single purchase receipt to pre-fill an expense form.
Return ONLY a JSON object (no markdown, no commentary) with exactly these keys:
- "amount": number — the grand total actually paid (the largest "total" incl. tax). null if unclear.
- "date": string "YYYY-MM-DD" — the purchase/transaction date. null if not shown.
- "vendor": string — the merchant / store name. null if not shown.
- "gst": number — the total GST/tax amount shown on the receipt. null if not shown.
- "items": array of the individual line items on the receipt, each {"description": string, "amount": number (the line total incl. tax), "gst": number or null}. Use [] if the receipt is not itemised.
Use null for anything you cannot read confidently. Do not guess values that aren't on the receipt.
Dates are Australian format: day/month/year (e.g. "2/7/2026" means 2 July 2026 -> "2026-07-02").
The image may be a phone photo of a printed receipt — read small text carefully and use the largest "total" figure as the grand total.`;

function coerce(raw: unknown): OcrResult {
  const o = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length ? t : null;
  };
  const date = str(o.date);
  const rawItems = Array.isArray(o.items) ? o.items : [];
  const items: OcrLineItem[] = rawItems
    .map((it) => {
      const r = (it ?? {}) as Record<string, unknown>;
      return { description: str(r.description) ?? "", amount: num(r.amount), gst: num(r.gst) };
    })
    .filter((it): it is OcrLineItem => it.description !== "" && it.amount != null && it.amount > 0);
  return {
    amount: num(o.amount),
    // Only accept a plausible ISO date; otherwise drop it so the form isn't polluted.
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    vendor: str(o.vendor),
    gst: num(o.gst),
    items,
  };
}

export async function POST(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    // Feature simply unavailable without a key — the form still works manually.
    return NextResponse.json({ error: "Receipt scanning is not configured." }, { status: 503 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const isPdf = file.type === "application/pdf";
  const source = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: file.type, data: base64 } };
  // Photos benefit from the stronger model; PDFs read fine on the cheaper one.
  const model = isPdf ? OCR_MODEL : OCR_IMAGE_MODEL;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        temperature: 0,
        messages: [{ role: "user", content: [source, { type: "text", text: PROMPT }] }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Anthropic OCR error", res.status, detail);
      return NextResponse.json({ error: "Could not read the receipt." }, { status: 502 });
    }

    const data = await res.json();
    const text: string =
      Array.isArray(data?.content)
        ? data.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("")
        : "";

    // Pull the JSON object out of the model's reply (handles stray code fences/text).
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: "No data found." }, { status: 422 });

    let parsed: unknown;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ error: "No data found." }, { status: 422 });
    }

    return NextResponse.json(coerce(parsed));
  } catch (err) {
    console.error("Receipt OCR failed", err);
    return NextResponse.json({ error: "Could not read the receipt." }, { status: 502 });
  }
}
