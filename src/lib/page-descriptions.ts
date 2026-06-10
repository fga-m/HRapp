import { supabaseAdmin } from "./supabase";

export async function getPageDescription(pageKey: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", `page_desc:${pageKey}`)
    .maybeSingle();
  return data?.value ?? null;
}
