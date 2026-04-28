import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

let adminClient: SupabaseClient | null = null;

export function createSupabaseAdmin() {
  if (adminClient) {
    return adminClient;
  }

  adminClient = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  return adminClient;
}
