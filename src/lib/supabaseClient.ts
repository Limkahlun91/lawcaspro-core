import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Supabase credentials missing! Please check your .env file.')
}

// Create a client with placeholders if missing to prevent "undefined" crashes in UI
// This allows the app to load even if the connection is broken (showing network errors instead of white screen)
export const supabase = createClient(
  url || 'https://placeholder.supabase.co', 
  key || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
)

export const hasSupabase = Boolean(url && key)
