import {
  createClient,
  type Session,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

export interface LokClientConfig {
  url: string;
  anonKey: string;
}

export function createLokClient(config: LokClientConfig): SupabaseClient {
  return createClient(config.url, config.anonKey);
}

export type { Session, SupabaseClient, User };
