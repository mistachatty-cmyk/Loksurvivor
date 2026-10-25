import { Heart } from 'lucide-react';

import { useT } from '@/lib/i18n';
import { readListening, toggleFavorite, useListening, writeListening } from '@/lib/listening';

/** A heart for the playing song. Hearted songs gather on the Favorites shelf the next time the room opens. */
export function FavoriteButton({ trackId, size = 20, className = '', testId = 'button-favorite' }: { trackId: string | null | undefined; size?: number; className?: string; testId?: string }) {
  const t = useT();
  const { favorites } = useListening();
  const on = !!trackId && favorites.includes(trackId);
  return (
    <button
      type="button"
      disabled={!trackId}
      onClick={() => trackId && writeListening(toggleFavorite(readListening(), trackId))}
      aria-pressed={on}
      aria-label={on ? t('listening.unfavorite') : t('listening.favorite')}
      title={on ? t('listening.unfavorite') : t('listening.favorite')}
      className={`rounded-full p-2 disabled:opacity-30 ${on ? 'text-rose-300' : 'text-white/60'} ${className}`}
      data-testid={testId}
    >
      <Heart size={size} fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}

export default FavoriteButton;
