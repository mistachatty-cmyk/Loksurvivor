import type { SupabaseClient } from "@supabase/supabase-js";

export type FeedbackCategory = "bug" | "idea" | "balance" | "other";

export interface SubmitFeedbackInput {
  /** Which product/context this feedback is for, e.g. "616_survivor". */
  source: string;
  message: string;
  category?: FeedbackCategory;
  /** 1-5 */
  rating?: number;
  contactEmail?: string;
  userId?: string;
}

export async function submitFeedback(
  client: SupabaseClient,
  input: SubmitFeedbackInput,
) {
  return client.from("product_feedback").insert({
    source: input.source,
    message: input.message,
    category: input.category ?? null,
    rating: input.rating ?? null,
    contact_email: input.contactEmail ?? null,
    user_id: input.userId ?? null,
  });
}
