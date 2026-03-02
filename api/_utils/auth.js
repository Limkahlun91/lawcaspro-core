import { createClient } from '@supabase/supabase-js';
import { adminClient } from './admin-client.js';

export async function verifyUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  
  // Use a temporary client to verify the token with Supabase Auth
  // This ensures the token is valid and not revoked
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  // Fetch the user's profile using the admin client to ensure we get the firm_id
  // This bypasses RLS on profiles to guarantee we get the info needed for security checks
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('firm_id, role, full_name')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('User profile not found');
  }

  if (!profile.firm_id) {
    throw new Error('User is not associated with any firm');
  }

  return {
    user,
    profile,
    firmId: profile.firm_id,
    userId: user.id
  };
}
