import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationPreference = "email" | "sms" | "both" | "none";

export interface JoinWaitlistInput {
  /** Which product/context this signup is for, e.g. "616_survivor_alpha". */
  source: string;
  email: string;
  phone?: string;
  notificationPref?: NotificationPreference;
  /**
   * founder_signups.handle is required by the shared schema; when omitted
   * it's derived from the email's local part so callers don't need to
   * collect a separate display name just to join a waitlist.
   */
  handle?: string;
}

export async function joinWaitlist(
  client: SupabaseClient,
  input: JoinWaitlistInput,
) {
  const handle = input.handle ?? input.email.split("@")[0] ?? input.email;
  return client.from("founder_signups").insert({
    source: input.source,
    handle,
    email: input.email,
    phone: input.phone ?? null,
    notification_pref: input.notificationPref ?? null,
  });
}
