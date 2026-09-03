import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  getSession,
  joinWaitlist,
  onAuthStateChange,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signOut as signOutClient,
  signUpWithEmail,
  submitFeedback,
  type FeedbackCategory,
  type JoinWaitlistInput,
  type NotificationPreference,
  type Session,
  type SubmitFeedbackInput,
  type User,
} from '@workspace/lok-client';

import { lokClient } from '@/lib/lokClient';

/** Product identifier passed to shared cross-product tables (founder_signups, product_feedback). */
const SOURCE = '616_survivor';

interface AuthContextValue {
  /** False until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are configured -- login/waitlist/feedback UI should disable itself. */
  available: boolean;
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  joinWaitlist: (input: Omit<JoinWaitlistInput, 'source'>) => Promise<{ error: string | null }>;
  submitFeedback: (input: Omit<SubmitFeedbackInput, 'source' | 'userId'>) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(lokClient));

  useEffect(() => {
    if (!lokClient) return;
    let cancelled = false;
    getSession(lokClient).then(({ session }) => {
      if (!cancelled) {
        setSession(session);
        setLoading(false);
      }
    });
    const unsubscribe = onAuthStateChange(lokClient, (session) => setSession(session));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const doSignInWithEmail = useCallback(async (email: string, password: string) => {
    if (!lokClient) return { error: 'Auth is not configured yet.' };
    const { error } = await signInWithEmail(lokClient, email, password);
    return { error: error?.message ?? null };
  }, []);

  const doSignUpWithEmail = useCallback(async (email: string, password: string) => {
    if (!lokClient) return { error: 'Auth is not configured yet.' };
    const { error } = await signUpWithEmail(lokClient, email, password);
    return { error: error?.message ?? null };
  }, []);

  const doSignInWithGoogle = useCallback(async () => {
    if (!lokClient) return { error: 'Auth is not configured yet.' };
    const { error } = await signInWithGoogle(lokClient);
    return { error: error?.message ?? null };
  }, []);

  const doSignInWithApple = useCallback(async () => {
    if (!lokClient) return { error: 'Auth is not configured yet.' };
    const { error } = await signInWithApple(lokClient);
    return { error: error?.message ?? null };
  }, []);

  const doSignOut = useCallback(async () => {
    if (!lokClient) return;
    await signOutClient(lokClient);
  }, []);

  const doJoinWaitlist = useCallback(async (input: Omit<JoinWaitlistInput, 'source'>) => {
    if (!lokClient) return { error: 'Waitlist is not configured yet.' };
    const { error } = await joinWaitlist(lokClient, { ...input, source: SOURCE });
    return { error: error?.message ?? null };
  }, []);

  const doSubmitFeedback = useCallback(
    async (input: Omit<SubmitFeedbackInput, 'source' | 'userId'>) => {
      if (!lokClient) return { error: 'Feedback is not configured yet.' };
      const { error } = await submitFeedback(lokClient, {
        ...input,
        source: SOURCE,
        userId: session?.user.id,
      });
      return { error: error?.message ?? null };
    },
    [session],
  );

  const value: AuthContextValue = {
    available: Boolean(lokClient),
    session,
    user: session?.user ?? null,
    loading,
    signInWithEmail: doSignInWithEmail,
    signUpWithEmail: doSignUpWithEmail,
    signInWithGoogle: doSignInWithGoogle,
    signInWithApple: doSignInWithApple,
    signOut: doSignOut,
    joinWaitlist: doJoinWaitlist,
    submitFeedback: doSubmitFeedback,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export type { FeedbackCategory, NotificationPreference };
