import { createClient } from "@supabase/supabase-js";

/**
 * Server-only client using the secret key — bypasses RLS entirely.
 * Never import this from a Client Component. Only call it after
 * independently verifying the caller's identity (e.g. via getUser()).
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
