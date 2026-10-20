import { useEffect, useState } from 'react';

/**
 * Dev only (mounted behind `import.meta.env.DEV`): `window.__lokCrash.render()` makes this
 * component throw while rendering, so the LokServer pop-up and the dev tooling can be seen working.
 */
export function LokCrashProbe() {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const arm = () => setArmed(true);
    window.addEventListener('lok-crash-render', arm);
    return () => window.removeEventListener('lok-crash-render', arm);
  }, []);
  if (armed) {
    throw new Error('LokErrorReport test: this screen crashed on purpose');
  }
  return null;
}
