import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

export function createAdminClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = serverEnv();
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
