import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

// Client for use in browser / client components (respects RLS)
export const supabase = createClient(supabaseUrl, supabasePublishableKey);

// Admin client for server-side only (bypasses RLS where needed)
export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);
