import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch (_) {
    return false;
  }
};

const isSupabaseConfigured = supabaseUrl && isValidUrl(supabaseUrl) && supabaseAnonKey;

if (!isSupabaseConfigured) {
  console.warn('Supabase environment variables missing or invalid - running in stub mode');
}

export const supabase = isSupabaseConfigured 
  ? (() => {
      try {
        return createClient(supabaseUrl, supabaseAnonKey);
      } catch (e) {
        console.error('Failed to initialize Supabase:', e);
        return null;
      }
    })()
  : null;
