import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// A URL e a chave publicável podem ficar no código: são públicas por natureza.
// A proteção dos dados é feita pelas regras de acesso (RLS) no banco.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://bqwzaesagwjyisaxbowk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_CVbjV0zAM1Hj13AUy5a2yw_LbBSFgLX";

const isBrowser = typeof window !== "undefined";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
  },
});
