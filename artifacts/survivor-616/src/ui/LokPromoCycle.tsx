/**
 * The hub's ad slot: LokShop, the Sleeve Counter, the newest updates and anything pinned in
 * `promoSlides.ts` take turns, cross-fading every few seconds. Each slide is a button that
 * jumps straight to its place in the game. All art is procedural SVG/CSS, so the slot adds
 * no network or image cost. The timer pauses when the tab is hidden, on hover/focus, and
 * never auto-advances for reduced-motion players (the dots still work).
 */
import { useEffect, useMemo, useState } from 'react';

import { CHANGELOG } from '@/game/data/changelog';
import { buildPromoSlides, type PromoArt, type PromoSlide, type PromoTarget } from '@/game/data/promoSlides';

import { HoloOwl } from './HoloOwl';

const CYCLE_MS = 8000;

function SleeveArt({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="promo-foil" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".95" />
          <stop offset=".5" stopColor="#67e8f9" stopOpacity=".85" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity=".95" />
        </linearGradient>
      </defs>
      <path d="M22 8 L26 5 L30 8 L34 5 L38 8 L42 5 L46 8 L50 5 L54 8 L58 5 L58 72 L54 75 L50 72 L46 75 L42 72 L38 75 L34 72 L30 75 L26 72 L22 75 Z" fill="url(#promo-foil)" stroke="#fff" strokeOpacity=".7" strokeWidth="1.5" />
      <path d="M26 24 L54 24 M26 32 L54 32" stroke="#020617" strokeOpacity=".55" strokeWidth="3" />
      <circle cx="40" cy="52" r="9" fill="#020617" fillOpacity=".6" stroke="#fff" strokeOpacity=".8" strokeWidth="1.5" />
      <path d="M36 52 L44 52 M40 48 L40 56" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

function SupportersArt() {
  const names = [{ y: 22, c: '#5eead4', w: 40 }, { y: 40, c: '#38bdf8', w: 52 }, { y: 58, c: '#fbbf24', w: 34 }];
  return (
    <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden="true">
      {names.map((n) => (
        <g key={n.y}>
          <circle cx="14" cy={n.y} r="3.5" fill={n.c} />
          <rect x="24" y={n.y - 3} width={n.w} height="6" rx="3" fill={n.c} fillOpacity=".75" />
        </g>
      ))}
    </svg>
  );
}

function UpdateArt({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden="true">
      <path d="M14 34 L50 18 L50 62 L14 46 Z" fill={color} fillOpacity=".25" stroke={color} strokeWidth="3" strokeLinejoin="round" />
      <path d="M20 48 L26 66 L36 66 L32 52" fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
      <path d="M58 30 Q68 40 58 50 M64 24 Q80 40 64 56" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function SlideArt({ art, accent }: { art: PromoArt; accent: string }) {
  if (art === 'owl') return <HoloOwl mood="pleased" className="h-full w-full" />;
  if (art === 'sleeve') return <SleeveArt color={accent} />;
  if (art === 'supporters') return <SupportersArt />;
  return <UpdateArt color={accent} />;
}

export function LokPromoCycle({ onOpen, slides: slidesProp }: { onOpen: (target: PromoTarget) => void; slides?: PromoSlide[] }) {
  const slides = useMemo(() => slidesProp ?? buildPromoSlides(CHANGELOG), [slidesProp]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMotion = () => setReduced(query?.matches === true);
    query?.addEventListener?.('change', onMotion);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      query?.removeEventListener?.('change', onMotion);
    };
  }, []);

  const running = slides.length > 1 && !paused && !hidden && !reduced;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), CYCLE_MS);
    return () => window.clearInterval(id);
  }, [running, slides.length]);

  if (slides.length === 0) return null;
  const slide = slides[index % slides.length]!;

  return (
    <section
      className="lokshop-holo mb-4 flex items-stretch"
      style={{ borderColor: `${slide.accent}88` }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="News and offers"
      data-testid="promo-cycle"
    >
      <button
        key={slide.id}
        type="button"
        onClick={() => onOpen(slide.target)}
        className="promo-slide flex min-w-0 flex-1 items-center gap-3 p-3 text-left"
        data-testid={`promo-slide-${slide.id}`}
      >
        <span className="block h-14 w-14 shrink-0 sm:h-16 sm:w-16"><SlideArt art={slide.art} accent={slide.accent} /></span>
        <span className="min-w-0">
          {slide.tag ? <span className="block font-mono text-[9px] uppercase tracking-widest" style={{ color: slide.accent }}>{slide.tag}</span> : null}
          <span className="block truncate text-sm font-black uppercase tracking-wide text-white">{slide.title}</span>
          <span className="block text-xs text-muted-foreground line-clamp-2">{slide.blurb}</span>
        </span>
      </button>
      {slides.length > 1 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 px-2">
          {slides.map((entry, i) => (
            <button key={entry.id} type="button" onClick={() => setIndex(i)} aria-label={entry.title} aria-current={i === index % slides.length} className={`h-2 w-2 rounded-full border border-white/40 ${i === index % slides.length ? 'bg-white' : 'bg-transparent'}`} data-testid={`promo-dot-${entry.id}`} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
