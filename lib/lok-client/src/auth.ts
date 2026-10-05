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

type OAuthProvider = "google" | "apple";

/**
 * Providers (Google especially) refuse to render their sign-in page inside an
 * iframe, which is how the GSix hub's game player embeds the game. When
 * framed, ask Supabase for the provider URL instead of redirecting the frame,
 * and send the top window there. Returning lands on the game's own origin,
 * which is same-site with the hub, so the session is visible to the embed too.
 * The embedding page must allow it (sandbox allow-top-navigation-by-user-activation).
 */
async function signInWithProvider(
  client: SupabaseClient,
  provider: OAuthProvider,
  redirectTo?: string,
) {
  const framed = typeof window !== "undefined" && window.self !== window.top;
  const target =
    redirectTo ?? (typeof window !== "undefined" ? window.location.origin : undefined);
  const result = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: target, skipBrowserRedirect: framed },
  });
  if (framed && result.data?.url && !result.error) {
    try {
      window.top!.location.href = result.data.url;
    } catch {
      return {
        data: result.data,
        error: new Error(
          "Sign-in can't open inside this embedded player. Use \"Open standalone window\" and sign in there.",
        ),
      };
    }
  }
  return result;
}

export function signInWithGoogle(client: SupabaseClient, redirectTo?: string) {
  return signInWithProvider(client, "google", redirectTo);
}

export function signInWithApple(client: SupabaseClient, redirectTo?: string) {
  return signInWithProvider(client, "apple", redirectTo);
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
