/**
 * "Submit your music": a call to action for artists and creatives, host #1 of
 * the Lok artist-submit plugin (`packages/lok-artist-submit`).
 *
 * This file is only the 616 Survivor shell around the plugin: layout, our
 * dialog and our translated copy. Validation, the email and the opt-in all live
 * in the package, so another Lok product writes its own shell and gets the same
 * behaviour. Nothing is sent over the network: the artist's own email app does
 * the sending, which is also why the artist attaches the file themselves.
 */
import { useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Check, Copy, Mail } from 'lucide-react';
import '@lok/artist-submit/styles.css';
import {
  type ArtistSubmitConfig,
  buildEmailText,
  buildMailtoUrl,
  buildSubmissionEmail,
  isMountedAt,
  validateSubmission,
  type ArtistSubmissionInput,
  type ArtistSubmitMount,
  type SubmissionEmail,
  type SubmissionErrors,
  type SubmissionField,
} from '@lok/artist-submit';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useT, type MessageKey } from '@/lib/i18n';
import { ARTIST_SUBMIT_CONFIG, ARTIST_SUBMIT_FEATURE } from '@/lib/lokFeatures';

type Status = 'idle' | 'sent' | 'copied' | 'copyFailed';

const EMPTY: ArtistSubmissionInput = { creatorName: '', creatorEmail: '', workTitle: '' };
const ACCENT = { '--lok-artist-accent': 'hsl(var(--primary))' } as CSSProperties;
const INPUT_CLASS =
  'mt-1 w-full border border-border bg-black/40 px-3 py-2 text-sm text-white placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none';

export function ArtistSubmitCta({ mount }: { mount: ArtistSubmitMount }) {
  if (!ARTIST_SUBMIT_CONFIG || !isMountedAt(ARTIST_SUBMIT_FEATURE, mount)) return null;
  return <ArtistSubmitCtaInner config={ARTIST_SUBMIT_CONFIG} />;
}

function ArtistSubmitCtaInner({ config }: { config: ArtistSubmitConfig }) {
  const t = useT();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ArtistSubmissionInput>(EMPTY);
  const [errors, setErrors] = useState<SubmissionErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const titleId = `${uid}-cta-title`;
  const fieldId = (field: SubmissionField) => `${uid}-${field}`;

  const change = (field: SubmissionField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    setStatus('idle');
  };

  /** Returns the finished email, or null after showing what is missing. */
  const prepare = (): SubmissionEmail | null => {
    const result = validateSubmission(values);
    if (!result.ok) {
      setErrors(result.errors);
      setStatus('idle');
      const first = (['creatorName', 'creatorEmail', 'workTitle'] as const).find((field) => result.errors[field]);
      if (first) formRef.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return null;
    }
    setErrors({});
    return buildSubmissionEmail(result.value, config);
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    const email = prepare();
    if (!email) return;
    window.location.href = buildMailtoUrl(email);
    setStatus('sent');
  };

  const copy = async () => {
    const email = prepare();
    if (!email) return;
    try {
      await navigator.clipboard.writeText(buildEmailText(email));
      setStatus('copied');
    } catch {
      setStatus('copyFailed');
    }
  };

  const fields: ReadonlyArray<{
    field: SubmissionField;
    label: MessageKey;
    placeholder: MessageKey;
    type: string;
    autoComplete: string;
    inputMode?: 'email';
  }> = [
    { field: 'creatorName', label: 'artistSubmit.field.name', placeholder: 'artistSubmit.field.namePlaceholder', type: 'text', autoComplete: 'name' },
    { field: 'creatorEmail', label: 'artistSubmit.field.email', placeholder: 'artistSubmit.field.emailPlaceholder', type: 'email', autoComplete: 'email', inputMode: 'email' },
    { field: 'workTitle', label: 'artistSubmit.field.work', placeholder: 'artistSubmit.field.workPlaceholder', type: 'text', autoComplete: 'off' },
  ];

  const statusMessage: Record<Exclude<Status, 'idle'>, MessageKey> = {
    sent: 'artistSubmit.sent',
    copied: 'artistSubmit.copied',
    copyFailed: 'artistSubmit.copyFailed',
  };

  return (
    <>
      <section
        className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-primary/35 bg-card/50 p-4"
        aria-labelledby={titleId}
        style={ACCENT}
        data-testid="artist-submit-cta"
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="lok-artist-eq mt-0.5" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <div className="min-w-0">
            <p id={titleId} className="text-xs font-bold uppercase tracking-[0.2em] text-white">
              {t('artistSubmit.cta.title')}
            </p>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">{t('artistSubmit.cta.body')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="lok-artist-btn flex w-full items-center justify-center gap-2 bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground sm:w-auto"
          data-testid="button-artist-submit"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          {t('artistSubmit.cta.button')}
        </button>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          ref={dialogRef}
          className="max-h-[80dvh] overflow-y-auto sm:max-w-lg"
          style={ACCENT}
          // Do not jump into the first field: on a phone that raises the keyboard over the instructions.
          // Focus the dialog itself so keyboard and screen-reader users still land inside it.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            dialogRef.current?.focus({ preventScroll: true });
          }}
          data-testid="artist-submit-dialog"
        >
          <DialogTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-primary">
            <span className="lok-artist-eq" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            {t('artistSubmit.dialog.title')}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            {t('artistSubmit.dialog.intro')}
          </DialogDescription>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white">{t('artistSubmit.step1.title')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('artistSubmit.step1.body')}</p>
            <ul className="mt-2 grid gap-1" data-testid="artist-submit-formats">
              {config.formats.map((format) => (
                <li key={format.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={`shrink-0 border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest ${
                      format.preferred ? 'border-primary bg-primary/15 text-primary' : 'border-border text-white'
                    }`}
                  >
                    .{format.ext}
                  </span>
                  {t(`artistSubmit.format.${format.id}` as MessageKey)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
              {t('artistSubmit.step1.size', { mb: config.maxAttachmentMb })}
            </p>
          </div>

          <form ref={formRef} onSubmit={send} noValidate>
            <p className="text-xs font-bold uppercase tracking-widest text-white">{t('artistSubmit.step2.title')}</p>
            <div className="mt-2 grid gap-3">
              {fields.map(({ field, label, placeholder, type, autoComplete, inputMode }) => {
                const error = errors[field];
                return (
                  <div key={field}>
                    <label htmlFor={fieldId(field)} className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      {t(label)}
                    </label>
                    <input
                      id={fieldId(field)}
                      name={field}
                      type={type}
                      inputMode={inputMode}
                      autoComplete={autoComplete}
                      maxLength={field === 'creatorEmail' ? 254 : 120}
                      value={values[field]}
                      onChange={(event) => change(field, event.target.value)}
                      placeholder={t(placeholder)}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${fieldId(field)}-error` : undefined}
                      className={`${INPUT_CLASS} ${error ? 'border-destructive' : ''}`}
                      data-testid={`input-artist-${field}`}
                    />
                    {error && (
                      <p id={`${fieldId(field)}-error`} className="mt-1 text-[11px] text-destructive" role="alert">
                        {t(`artistSubmit.error.${error}` as MessageKey)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-white">{t('artistSubmit.step3.title')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('artistSubmit.step3.body')}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {t('artistSubmit.address')}:{' '}
              <span className="select-all break-all font-mono text-white" data-testid="artist-submit-address">
                {config.recipient}
              </span>
            </p>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                className="lok-artist-btn flex w-full items-center justify-center gap-2 bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground sm:w-auto"
                data-testid="button-artist-send"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                {t('artistSubmit.send')}
              </button>
              <button
                type="button"
                onClick={() => void copy()}
                className="flex w-full items-center justify-center gap-2 border border-border px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:border-primary hover:text-primary sm:w-auto"
                data-testid="button-artist-copy"
              >
                {status === 'copied' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {t('artistSubmit.copy')}
              </button>
            </div>

            {status !== 'idle' && (
              <p className="mt-3 text-xs leading-relaxed text-primary" role="status" data-testid="artist-submit-status">
                {t(statusMessage[status])}
              </p>
            )}
          </form>

          <div className="grid gap-1 border-t border-border/50 pt-3 text-[11px] leading-relaxed text-muted-foreground/80">
            <p>{t('artistSubmit.rights')}</p>
            <p>{t('artistSubmit.privacy')}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
