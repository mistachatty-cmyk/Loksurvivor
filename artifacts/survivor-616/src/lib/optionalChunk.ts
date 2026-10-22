/**
 * Optional pieces (like the floating discs) load as separate code chunks. If one is missing after a
 * deploy, the app-wide handler normally reloads the page to fetch the new build, which would throw the
 * player out of what they were doing. While an optional chunk loads, that reload is skipped: the piece
 * simply does not appear and the rest of the screen carries on.
 */
let loading = 0;

export function optionalChunkLoading(): boolean {
  return loading > 0;
}

export async function optionalImport<T>(load: () => Promise<T>): Promise<T> {
  loading += 1;
  try {
    return await load();
  } finally {
    // The preload error event fires before the promise settles; wait a tick so it still sees the flag.
    window.setTimeout(() => {
      loading -= 1;
    }, 50);
  }
}
