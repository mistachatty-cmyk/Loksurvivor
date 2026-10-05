import {
  createClient,
  type Session,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { LokSessionAdapter } from "./session";

export interface LokClientConfig {
  url: string;
  anonKey: string;
}

export function createLokClient(config: LokClientConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      storage: new LokSessionAdapter(),
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export type { Session, SupabaseClient, User };
