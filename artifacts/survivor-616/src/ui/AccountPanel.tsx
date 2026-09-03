import { useState, type FormEvent } from 'react';
import { Mail, MessageSquareText, Phone, ShieldCheck } from 'lucide-react';

import { useAuth, type NotificationPreference } from '@/state/authStore';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScreenLayout } from './ScreenLayout';

export interface AccountPanelProps {
  onBack: () => void;
}

const NOTIFICATION_OPTIONS: { value: NotificationPreference; label: string }[] = [
  { value: 'email', label: 'Email only' },
  { value: 'sms', label: 'Text only' },
  { value: 'both', label: 'Email & text' },
  { value: 'none', label: "Don't notify me" },
];

function WaitlistForm() {
  const { available, joinWaitlist } = useAuth();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notificationPref, setNotificationPref] = useState<NotificationPreference>('email');
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email) return;
    setSubmitting(true);
    const { error } = await joinWaitlist({ email, phone: phone || undefined, notificationPref });
    setSubmitting(false);
    if (error) {
      toast({ title: "Couldn't join the waitlist", description: error, variant: 'destructive' });
      return;
    }
    setJoined(true);
    toast({ title: "You're on the list!", description: "We'll let you know when 616 Survivor fully launches." });
  };

  if (joined) {
    return (
      <div className="border border-primary/40 bg-primary/10 p-6 text-center" data-testid="waitlist-confirmation">
        <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">
          Thanks -- you're on the alpha waitlist. We'll reach out at <span className="text-white">{email}</span> when it's time.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-waitlist">
      <p className="text-sm text-muted-foreground">
        616 Survivor is still in alpha. Join the waitlist to get notified the moment it fully launches.
      </p>
      <div className="space-y-2">
        <Label htmlFor="waitlist-email">Email</Label>
        <Input
          id="waitlist-email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="input-waitlist-email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="waitlist-phone">Phone (optional)</Label>
        <Input
          id="waitlist-phone"
          type="tel"
          placeholder="(555) 555-5555"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          data-testid="input-waitlist-phone"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="waitlist-pref">How should we notify you?</Label>
        <Select value={notificationPref} onValueChange={(value) => setNotificationPref(value as NotificationPreference)}>
          <SelectTrigger id="waitlist-pref" data-testid="select-waitlist-pref">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NOTIFICATION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={!available || submitting || !email} className="w-full" data-testid="button-join-waitlist">
        {submitting ? 'Joining...' : 'Join the waitlist'}
      </Button>
      {!available && <p className="text-xs text-destructive">Waitlist signup isn't configured in this environment yet.</p>}
    </form>
  );
}

function LoginForm() {
  const { available, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, user, signOut } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return (
      <div className="space-y-4 border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="text-white">{user.email}</span>.
        </p>
        <Button variant="outline" onClick={() => void signOut()} data-testid="button-sign-out">
          Sign out
        </Button>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    const { error } = mode === 'sign-in' ? await signInWithEmail(email, password) : await signUpWithEmail(email, password);
    setSubmitting(false);
    if (error) {
      toast({ title: mode === 'sign-in' ? 'Sign in failed' : 'Sign up failed', description: error, variant: 'destructive' });
      return;
    }
    toast({
      title: mode === 'sign-in' ? 'Welcome back' : 'Account created',
      description: mode === 'sign-up' ? 'Check your email to confirm your account.' : undefined,
    });
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    const { error } = provider === 'google' ? await signInWithGoogle() : await signInWithApple();
    if (error) {
      toast({ title: `${provider === 'google' ? 'Google' : 'Apple'} sign-in unavailable`, description: error, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(value) => setMode(value as 'sign-in' | 'sign-up')}>
        <TabsList className="w-full">
          <TabsTrigger value="sign-in" className="flex-1" data-testid="tab-sign-in">
            Sign in
          </TabsTrigger>
          <TabsTrigger value="sign-up" className="flex-1" data-testid="tab-sign-up">
            Create account
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-login">
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="input-login-email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="input-login-password"
          />
        </div>
        <Button type="submit" disabled={!available || submitting} className="w-full" data-testid="button-submit-login">
          {submitting ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-2">
        <Button variant="outline" onClick={() => void handleOAuth('google')} data-testid="button-sign-in-google">
          Continue with Google
        </Button>
        <Button variant="outline" onClick={() => void handleOAuth('apple')} data-testid="button-sign-in-apple">
          Continue with Apple
        </Button>
      </div>
      {!available && <p className="text-xs text-destructive">Login isn't configured in this environment yet.</p>}
    </div>
  );
}

export function AccountPanel({ onBack }: AccountPanelProps) {
  return (
    <ScreenLayout title="Account" subtitle="Alpha waitlist & sign in" onBack={onBack}>
      <div className="mx-auto grid w-full max-w-xl gap-8">
        <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-waitlist">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Alpha waitlist</p>
              <h2 className="text-lg font-black uppercase text-white">Get launch notified</h2>
            </div>
          </div>
          <WaitlistForm />
        </section>

        <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-login">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Account</p>
              <h2 className="text-lg font-black uppercase text-white">Sign in or create an account</h2>
            </div>
          </div>
          <LoginForm />
        </section>
      </div>
      <p className="mx-auto mt-6 flex max-w-xl items-center gap-2 text-xs text-muted-foreground">
        <MessageSquareText className="h-4 w-4 shrink-0" />
        Have ideas or found a bug? Use Feedback in the hub to tell us.
      </p>
    </ScreenLayout>
  );
}
