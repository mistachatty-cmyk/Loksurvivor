/** The four ways a release can change the city. */
export type ChangelogKind = 'bugfix' | 'hotfix' | 'update' | 'expansion';

export const CHANGELOG_KIND_ORDER: ChangelogKind[] = ['bugfix', 'hotfix', 'update', 'expansion'];

export const CHANGELOG_KIND_META: Record<ChangelogKind, { label: string; color: string; lore: string }> = {
  bugfix: {
    label: 'Bugfix',
    color: '#34d399',
    lore: 'Small repairs keep the block moving.',
  },
  hotfix: {
    label: 'Hotfix',
    color: '#fbbf24',
    lore: 'A fast repair before the night runs on.',
  },
  update: {
    label: 'Major Update',
    color: '#22d3ee',
    lore: 'The city finds a brighter rhythm.',
  },
  expansion: {
    label: 'Expansion',
    color: '#ef4444',
    lore: 'Another part of the 616 opens up.',
  },
};

export const DEFAULT_UPDATE_POPUP_KINDS: Record<ChangelogKind, boolean> = {
  bugfix: true,
  hotfix: true,
  update: true,
  expansion: true,
};

/** Older saves have no choices; malformed individual values keep their default. */
export function normalizeUpdatePopupKinds(value: unknown): Record<ChangelogKind, boolean> {
  const saved = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(CHANGELOG_KIND_ORDER.map((kind) => [
    kind,
    typeof saved[kind] === 'boolean' ? saved[kind] : true,
  ])) as Record<ChangelogKind, boolean>;
}

export function visibleUpdatePopupEntries<T extends { kind: ChangelogKind }>(
  entries: T[],
  enabledKinds: Record<ChangelogKind, boolean>,
): T[] {
  return entries.filter((entry) => enabledKinds[entry.kind]);
}
