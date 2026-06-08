import { supabaseAdmin } from "./supabase";

/** Generic key/value app settings (table: app_settings). */

export const TOIL_WINDOW_KEY = "toil_window_weeks";
export const TOIL_WINDOW_DEFAULT = 4;
export const TOIL_WINDOW_MIN = 1;
export const TOIL_WINDOW_MAX = 12;

function clampToilWindow(weeks: number): number {
  return Math.min(TOIL_WINDOW_MAX, Math.max(TOIL_WINDOW_MIN, Math.round(weeks)));
}

/** Number of weeks the rolling TOIL window spans. Falls back to the default
 *  if the setting is missing or unparseable, and is always clamped to range. */
export async function getToilWindowWeeks(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", TOIL_WINDOW_KEY)
    .maybeSingle();
  const parsed = Number.parseInt(data?.value ?? "", 10);
  if (Number.isNaN(parsed)) return TOIL_WINDOW_DEFAULT;
  return clampToilWindow(parsed);
}

/** Persist the TOIL window length. Returns the clamped value actually stored. */
export async function setToilWindowWeeks(
  weeks: number,
  updatedBy: string | null
): Promise<number> {
  const clamped = clampToilWindow(weeks);
  await supabaseAdmin.from("app_settings").upsert(
    {
      key: TOIL_WINDOW_KEY,
      value: String(clamped),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "key" }
  );
  return clamped;
}
