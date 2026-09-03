import type { Session, SupabaseClient, User } from "./client";

export async function signUpWithEmail(
  client: SupabaseClient,
  email: string,
  password: string,
) {
  return client.auth.signUp({ email, password });
}

export async function signInWithEmail(
  client: SupabaseClient,
  email: string,
  password: string,
) {
  return client.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle(
  client: SupabaseClient,
  redirectTo?: string,
) {
  return client.auth.signInWithOAuth({
    provider: "google",
    options: redirectTo ? { redirectTo } : undefined,
  });
}

export async function signInWithApple(
  client: SupabaseClient,
  redirectTo?: string,
) {
  return client.auth.signInWithOAuth({
    provider: "apple",
    options: redirectTo ? { redirectTo } : undefined,
  });
}

export async function signOut(client: SupabaseClient) {
  return client.auth.signOut();
}

export async function getSession(client: SupabaseClient) {
  const { data, error } = await client.auth.getSession();
  return { session: data.session, error };
}

export function onAuthStateChange(
  client: SupabaseClient,
  callback: (session: Session | null, user: User | null) => void,
) {
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    callback(session, session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}
