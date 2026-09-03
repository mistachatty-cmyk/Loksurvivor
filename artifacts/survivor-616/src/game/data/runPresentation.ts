/** Small immutable queue helpers shared by non-blocking run presentations. */
export function appendRunPresentation<T>(
  queue: readonly T[],
  item: T,
): T[] {
  return [...queue, item];
}

export function updateRunPresentationHead<T>(
  queue: readonly T[],
  update: (head: T) => T,
): T[] {
  const head = queue[0];
  return head === undefined ? [...queue] : [update(head), ...queue.slice(1)];
}

export function dismissRunPresentation<T>(queue: readonly T[]): T[] {
  return queue.slice(1);
}

export function recordRunHistory<T>(
  history: readonly T[],
  item: T,
  limit = 8,
): T[] {
  return [item, ...history].slice(0, Math.max(1, limit));
}
