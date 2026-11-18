import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readEnv, requireEnv } from "@/server/config/env";

let serviceClient: SupabaseClient | undefined;

/**
 * Server-side Supabase client with the service role key.
 * Row Level Security is enabled on every table with no public policies, so the browser
 * never reads the database directly: all access goes through route handlers.
 */
export function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const env = readEnv();
    serviceClient = createClient(
      requireEnv("SUPABASE_URL", env),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY", env),
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return serviceClient;
}
