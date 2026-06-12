import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client using the secret service key. The `server-only`
 * import makes the build fail if this module is ever pulled into a client
 * bundle, so the key can never reach the browser (Architecture Rule 1).
 */
let cached: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.',
    );
  }

  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
