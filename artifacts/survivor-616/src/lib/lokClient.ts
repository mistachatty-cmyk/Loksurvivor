import { createLokClient } from '@workspace/lok-client';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Undefined when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY aren't set (e.g.
 * local dev without a .env file) -- callers must handle the missing-client
 * case rather than crashing the whole app on import.
 */
export const lokClient = url && anonKey ? createLokClient({ url, anonKey }) : undefined;
