import { useState, type FormEvent } from 'react';
import { MessageSquareHeart, Star } from 'lucide-react';

import { useAuth, type FeedbackCategory } from '@/state/authStore';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScreenLayout } from './ScreenLayout';

export interface FeedbackPanelProps {
  onBack: () => void;
}

const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: 'idea', label: 'Idea / suggestion' },
  { value: 'bug', label: 'Something broke' },
  { value: 'balance', label: 'Balance / difficulty' },
  { value: 'other', label: 'Other' },
];

export function FeedbackPanel({ onBack }: FeedbackPanelProps) {
  const { available, submitFeedback } = useAuth();
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('idea');
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    const { error } = await submitFeedback({
      message: message.trim(),
      category,
      rating,
      contactEmail: contactEmail || undefined,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Couldn't send feedback", description: error, variant: 'destructive' });
      return;
    }
    setSent(true);
    toast({ title: 'Thanks for the feedback!', description: "We read every submission." });
  };

  return (
    <ScreenLayout title="Feedback" subtitle="Tell us what you think" onBack={onBack}>
      <div className="mx-auto w-full max-w-xl">
        <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-feedback">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
              <MessageSquareHeart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">We're listening</p>
              <h2 className="text-lg font-black uppercase text-white">Ideas, bugs, anything</h2>
            </div>
          </div>

          {sent ? (
            <p className="text-sm text-muted-foreground" data-testid="feedback-confirmation">
              Feedback sent -- thank you for helping shape 616 Survivor.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-feedback">
              <div className="space-y-2">
                <Label htmlFor="feedback-category">Category</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as FeedbackCategory)}>
                  <SelectTrigger id="feedback-category" data-testid="select-feedback-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback-message">What's on your mind?</Label>
                <Textarea
                  id="feedback-message"
                  required
                  rows={5}
                  placeholder="A weapon idea, a bug you hit, a district you'd love to see..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  data-testid="input-feedback-message"
                />
              </div>

              <div className="space-y-2">
                <Label>Rating (optional)</Label>
                <div className="flex gap-1" data-testid="input-feedback-rating">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(rating === value ? undefined : value)}
                      aria-pressed={rating !== undefined && value <= rating}
                      className="p-1"
                      data-testid={`button-rating-${value}`}
                    >
                      <Star
                        className={`h-6 w-6 ${rating !== undefined && value <= rating ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback-email">Email (optional, if you'd like a reply)</Label>
                <Input
                  id="feedback-email"
                  type="email"
                  placeholder="you@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  data-testid="input-feedback-email"
                />
              </div>

              <Button type="submit" disabled={!available || submitting || !message.trim()} className="w-full" data-testid="button-submit-feedback">
                {submitting ? 'Sending...' : 'Send feedback'}
              </Button>
              {!available && <p className="text-xs text-destructive">Feedback isn't configured in this environment yet.</p>}
            </form>
          )}
        </section>
      </div>
    </ScreenLayout>
  );
}
