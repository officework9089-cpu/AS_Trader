import { createClient } from '@supabase/supabase-js';

// Get environment variables or fallback to empty strings
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing in .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);