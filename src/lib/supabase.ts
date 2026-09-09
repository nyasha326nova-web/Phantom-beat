import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export type Track = {
  id: string;
  user_id: string;
  title: string;
  artist: string;
  file_path: string;
  duration: number | null;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
};
