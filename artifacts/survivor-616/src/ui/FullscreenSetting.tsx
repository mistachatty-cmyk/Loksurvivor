import { useEffect, useState } from 'react';

/** Browser fullscreen is a session choice and always needs a direct user gesture. */
export function FullscreenSetting() {
  const [active, setActive] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement));
  const [error, setError] = useState('');
  const available = typeof document !== 'undefined' && document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function';

  useEffect(() => {
    const update = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const toggle = async () => {
    setError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setError('This browser did not allow fullscreen. Try its own fullscreen command.');
    }
  };

  return <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-fullscreen-settings">
    <h2 className="text-xl font-black uppercase text-white">Fullscreen</h2>
    <p className="mt-2 text-sm text-muted-foreground">Use the whole display while playing. Press Esc or use your browser controls to leave fullscreen.</p>
    <button type="button" onClick={() => void toggle()} disabled={!available} aria-pressed={active} className="mt-4 min-h-11 border border-primary px-4 text-xs font-bold uppercase text-primary disabled:border-border disabled:text-muted-foreground" data-testid="button-toggle-fullscreen">
      {!available ? 'Not supported here' : active ? 'Exit fullscreen' : 'Enter fullscreen'}
    </button>
    {error ? <p className="mt-2 text-sm text-amber-200" role="alert">{error}</p> : null}
  </section>;
}
