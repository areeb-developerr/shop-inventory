import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

export function fmt(paisa, currency = "Rs") {
  return `${currency} ${((Number(paisa) || 0) / 100).toLocaleString("en-PK")}`;
}
