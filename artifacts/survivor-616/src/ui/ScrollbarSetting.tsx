/** Settings row: scrollbar style and tint. Applies instantly, stored on this device only. */
import { useEffect, useState } from 'react';
import {
  SCROLLBAR_CHANGE_EVENT,
  getScrollbarStyle,
  getScrollbarTint,
  setScrollbarStyle,
  setScrollbarTint,
  type ScrollbarStyle,
  type ScrollbarTint,
} from '@/lib/scrollbar';

const STYLE_OPTIONS: { id: ScrollbarStyle; label: string }[] = [
  { id: 'slim', label: 'Slim' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'standard', label: 'Standard' },
];
const TINT_OPTIONS: { id: ScrollbarTint; label: string }[] = [
  { id: 'theme', label: 'Match theme' },
  { id: 'neutral', label: 'Neutral' },
];

function Choice<T extends string>(props: {
  title: string;
  options: { id: T; label: string }[];
  value: T;
  onPick: (id: T) => void;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h3 className="text-sm font-black uppercase tracking-wide text-white">{props.title}</h3>
      <div className="flex flex-wrap gap-2" role="group" aria-label={props.title}>
        {props.options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => props.onPick(option.id)}
            aria-pressed={props.value === option.id}
            className={`border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
              props.value === option.id
                ? 'border-primary/60 bg-primary/15 text-primary'
                : 'border-border bg-background text-muted-foreground hover:border-primary/60 hover:text-white'
            }`}
            data-testid={`${props.testId}-${option.id}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ScrollbarSetting() {
  const [style, setStyle] = useState(getScrollbarStyle);
  const [tint, setTint] = useState(getScrollbarTint);
  useEffect(() => {
    const sync = () => {
      setStyle(getScrollbarStyle());
      setTint(getScrollbarTint());
    };
    window.addEventListener(SCROLLBAR_CHANGE_EVENT, sync);
    return () => window.removeEventListener(SCROLLBAR_CHANGE_EVENT, sync);
  }, []);
  return (
    <div className="mt-3 space-y-4 border border-border/70 bg-background/50 p-4">
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
        A thin scrollbar that follows your UI theme. Hide it entirely or go back to your browser's own.
      </p>
      <Choice title="Style" options={STYLE_OPTIONS} value={style} onPick={setScrollbarStyle} testId="button-scrollbar-style" />
      <Choice title="Color" options={TINT_OPTIONS} value={tint} onPick={setScrollbarTint} testId="button-scrollbar-tint" />
    </div>
  );
}
