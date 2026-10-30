import { ViewportOverlay } from './ViewportOverlay';
/**
 * The match-over share panel. Two tabs:
 *  - Card: the run recap picture, plus one tap to the device share sheet, "Save image", copy the message, or send
 *    the message to X, Facebook, Reddit, WhatsApp, Telegram, Bluesky, email or text.
 *  - Clips: any part of the run you just played (the last ~36 seconds in 3 second pieces, plus the highlight clips).
 *    Pick one or several, then share or save them. Pieces are cut only from what the game already recorded on this
 *    device; nothing is uploaded anywhere.
 * Opened on demand from the summary, so none of this runs unless the player asks for it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clapperboard, Copy, Download, Image as ImageIcon, Share2, X } from 'lucide-react';
import { drawPosterCard, posterToBlob, toRecapProps, type GameRunSummaryLike } from '@lok/recap';

import { getRecentSegments } from '@/game/media/clipRecorder';
import { useT } from '@/lib/i18n';
import { buildShareLinks, clipExtension, SHARE_URL } from '@/lib/sharePlatforms';

export interface ShareHighlightClip {
  id: string;
  label: string;
  url: string;
}

interface Props {
  summary: GameRunSummaryLike;
  text: string;
  highlightClips: ShareHighlightClip[];
  onClose: () => void;
}

interface ClipItem {
  id: string;
  label: string;
  src: string;
  /** Loads the file lazily for share/save. */
  getBlob: () => Promise<Blob>;
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

type ShareNav = Navigator & { canShare?: (data: { files?: File[] }) => boolean };

export function ShareSheet({ summary, text, highlightClips, onClose }: Props) {
  const t = useT();
  const [tab, setTab] = useState<'card' | 'clips'>('card');
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const links = useMemo(() => buildShareLinks(text), [text]);
  const urlsRef = useRef<string[]>([]);

  // Draw the card now that the player asked for it.
  useEffect(() => {
    let cancelled = false;
    posterToBlob(drawPosterCard(toRecapProps(summary)))
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        urlsRef.current.push(url);
        setCardBlob(blob);
        setCardUrl(url);
      })
      .catch(() => setNote(t('share.cardFailed')));
    return () => {
      cancelled = true;
    };
  }, [summary, t]);

  // Everything the player can pick from: the recent pieces first (newest last), then the highlights.
  const clips = useMemo<ClipItem[]>(() => {
    const items: ClipItem[] = [];
    for (const [index, segment] of getRecentSegments().entries()) {
      const src = URL.createObjectURL(segment.blob);
      urlsRef.current.push(src);
      items.push({ id: `seg-${index}`, label: `${fmt(segment.startMs)} – ${fmt(segment.endMs)}`, src, getBlob: async () => segment.blob });
    }
    for (const clip of highlightClips) {
      items.push({ id: `hl-${clip.id}`, label: clip.label, src: clip.url, getBlob: async () => (await fetch(clip.url)).blob() });
    }
    return items;
  }, [highlightClips]);

  useEffect(
    () => () => {
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
    },
    [],
  );

  const flash = (message: string) => {
    setNote(message);
    window.setTimeout(() => setNote(''), 3200);
  };

  const shareFiles = async (files: File[], fallbackName: string) => {
    const nav = navigator as ShareNav;
    if (nav.canShare?.({ files })) {
      try {
        await navigator.share({ files, text });
        flash(t('share.shared'));
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
      }
    }
    for (const file of files) download(file, file.name || fallbackName);
    flash(t('share.saved'));
  };

  const shareCard = async () => {
    if (!cardBlob) return;
    await shareFiles([new File([cardBlob], 'loksurvivor-run.png', { type: 'image/png' })], 'loksurvivor-run.png');
  };

  const saveCard = () => {
    if (!cardBlob) return;
    download(cardBlob, 'loksurvivor-run.png');
    flash(t('share.saved'));
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${SHARE_URL}`);
      flash(t('share.copied'));
    } catch {
      flash(t('share.copyFailed'));
    }
  };

  const chosen = clips.filter((clip) => selected.has(clip.id));
  const toFiles = async (items: ClipItem[]) =>
    Promise.all(
      items.map(async (item, index) => {
        const blob = await item.getBlob();
        return new File([blob], `loksurvivor-clip-${index + 1}.${clipExtension(blob.type)}`, { type: blob.type || 'video/webm' });
      }),
    );

  const shareClips = async () => {
    if (chosen.length === 0) return;
    await shareFiles(await toFiles(chosen), 'loksurvivor-clip.webm');
  };

  const saveClips = async () => {
    if (chosen.length === 0) return;
    for (const file of await toFiles(chosen)) download(file, file.name);
    flash(t('share.saved'));
  };

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const tabClass = (active: boolean) =>
    `flex-1 min-h-11 border px-3 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
      active ? 'border-primary bg-primary/15 text-primary' : 'border-border text-white/60 hover:text-white'
    }`;
  const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 border border-border bg-card px-3 font-mono text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:border-primary active:scale-[0.98] disabled:opacity-40';

  return (
    <ViewportOverlay>
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={t('share.title')} data-testid="share-sheet">
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-lg font-black uppercase tracking-wide text-white">{t('share.title')}</h2>
          <button type="button" onClick={onClose} aria-label={t('share.close')} className="grid h-11 w-11 place-items-center border border-border text-white/70 hover:text-white" data-testid="button-share-close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 px-4 pt-3">
          <button type="button" onClick={() => setTab('card')} aria-pressed={tab === 'card'} className={tabClass(tab === 'card')} data-testid="tab-share-card">
            <ImageIcon className="mr-2 inline h-4 w-4" />{t('share.tab.card')}
          </button>
          <button type="button" onClick={() => setTab('clips')} aria-pressed={tab === 'clips'} className={tabClass(tab === 'clips')} data-testid="tab-share-clips">
            <Clapperboard className="mr-2 inline h-4 w-4" />{t('share.tab.clips')}{clips.length > 0 ? ` (${clips.length})` : ''}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {tab === 'card' ? (
            <div>
              <div className="mx-auto grid max-w-xs place-items-center border border-border bg-black/50 p-2">
                {cardUrl ? <img src={cardUrl} alt={t('share.cardAlt')} className="max-h-[46dvh] w-auto" /> : <p className="py-16 font-mono text-xs uppercase tracking-widest text-white/50">{t('share.drawing')}</p>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={shareCard} disabled={!cardBlob} className={`${actionClass} border-primary/60 bg-primary/10 text-primary`} data-testid="button-share-native">
                  <Share2 className="h-4 w-4" />{t('share.native')}
                </button>
                <button type="button" onClick={saveCard} disabled={!cardBlob} className={actionClass} data-testid="button-share-save-card">
                  <Download className="h-4 w-4" />{t('share.saveImage')}
                </button>
              </div>
              <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.25em] text-white/50">{t('share.sendTo')}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/55">{t('share.linkNote')}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {links.map((link) => (
                  <a key={link.id} href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className={actionClass} data-testid={`link-share-${link.id}`}>
                    {link.label}
                  </a>
                ))}
                <button type="button" onClick={copyText} className={actionClass} data-testid="button-share-copy">
                  <Copy className="h-4 w-4" />{t('share.copy')}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs leading-relaxed text-white/60">{t('share.clipsIntro')}</p>
              {clips.length === 0 ? (
                <p className="mt-6 border border-dashed border-border p-6 text-center text-sm text-white/55" data-testid="share-no-clips">{t('share.noClips')}</p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {clips.map((clip) => {
                    const on = selected.has(clip.id);
                    return (
                      <div key={clip.id} className={`border ${on ? 'border-primary' : 'border-border'} bg-black/40`}>
                        <video src={clip.src} muted playsInline loop controls preload="metadata" className="aspect-video w-full bg-black" />
                        <button type="button" onClick={() => toggle(clip.id)} aria-pressed={on} className={`flex min-h-11 w-full items-center justify-between gap-2 px-2 font-mono text-[10px] font-bold uppercase tracking-wider ${on ? 'bg-primary/15 text-primary' : 'text-white/70'}`} data-testid={`button-pick-clip-${clip.id}`}>
                          <span className="truncate">{clip.label}</span>
                          {on ? <Check className="h-4 w-4 shrink-0" /> : null}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={shareClips} disabled={chosen.length === 0} className={`${actionClass} border-primary/60 bg-primary/10 text-primary`} data-testid="button-share-clips">
                  <Share2 className="h-4 w-4" />{t('share.shareClips', { count: String(chosen.length) })}
                </button>
                <button type="button" onClick={saveClips} disabled={chosen.length === 0} className={actionClass} data-testid="button-save-clips">
                  <Download className="h-4 w-4" />{t('share.saveClips')}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="min-h-8 border-t border-border px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-primary" aria-live="polite" data-testid="share-note">{note}</p>
      </div>
    </div>
    </ViewportOverlay>
  );
}

export default ShareSheet;
