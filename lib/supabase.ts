import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const missing = [
  ...(!supabaseUrl ? ["NEXT_PUBLIC_SUPABASE_URL"] : []),
  ...(!supabaseAnonKey ? ["NEXT_PUBLIC_SUPABASE_ANON_KEY"] : []),
];

export const supabaseConfigured = missing.length === 0;

if (!supabaseConfigured && process.env.NODE_ENV === "development") {
  // eslint-disable-next-line no-console
  console.error(
    "Supabase not configured. Missing env vars:",
    missing,
    "\nSet NEXT_PUBLIC_SUPABASE_* variables in your environment."
  );
}

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : (null as unknown as SupabaseClient);
