import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// Read at build time. When unset, the file still loads and exports a null
// client; the rest of the app falls back to localStorage-only mode.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "minna-srs:auth",
      },
    })
  : null;

// Database row shapes — keep in sync with the schema in docs/supabase-schema.sql.
export interface ProgressRow {
  user_id: string;
  item_id: string;
  interval: number;
  ease_factor: number;
  next_review_date: string;
  last_reviewed_at: string | null;
  review_count: number;
  updated_at: string;
}

export interface ActiveChaptersRow {
  user_id: string;
  chapters: number[];
  updated_at: string;
}

export interface ReviewRow {
  user_id: string;
  item_id: string;
  grade: "forgot" | "understood" | "easy";
  reviewed_at: string;
}
