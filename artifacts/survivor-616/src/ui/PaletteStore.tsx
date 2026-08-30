import { THEMED_PALETTES_BY_ID } from '@/game/data/themedPalettes';
import { useMeta } from '@/game/state/metaStore';
import styles from './PaletteStore.module.css';

export function PaletteStore() {
  const { meta, buyPalette, equipPalette } = useMeta();

  const palettes = Object.values(THEMED_PALETTES_BY_ID).sort((a, b) => a.cost - b.cost);

  return (
    <div className={styles.store}>
      <div className={styles.header}>
        <h2>Theme Palettes</h2>
        <div className={styles.currency}>
          <span className={styles.label}>Loot Tokens:</span>
          <span className={styles.amount}>{meta.lootTokens}</span>
        </div>
      </div>

      <div className={styles.grid}>
        {palettes.map((palette) => {
          const isOwned = meta.ownedPaletteIds.includes(palette.id);
          const isActive = meta.activePaletteId === palette.id;
          const canAfford = meta.lootTokens >= palette.cost;

          return (
            <div
              key={palette.id}
              className={`${styles.card} ${isActive ? styles.active : ''}`}
              onClick={() => {
                if (isOwned && !isActive) {
                  equipPalette(palette.id);
                }
              }}
            >
              {/* Color preview */}
              <div
                className={styles.preview}
                style={{
                  background: `linear-gradient(135deg, ${palette.palette.accent} 0%, ${palette.palette.body} 100%)`,
                }}
              >
                {isActive && <div className={styles.activeIcon}>✓</div>}
              </div>

              {/* Info */}
              <div className={styles.info}>
                <h3>{palette.name}</h3>
                <p className={styles.description}>{palette.description}</p>

                {/* Button */}
                <div className={styles.footer}>
                  {isOwned ? (
                    <button
                      className={`${styles.button} ${isActive ? styles.active : styles.equip}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isActive) equipPalette(palette.id);
                      }}
                    >
                      {isActive ? 'Active' : 'Equip'}
                    </button>
                  ) : (
                    <button
                      className={`${styles.button} ${canAfford ? styles.buy : styles.disabled}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canAfford) buyPalette(palette.id);
                      }}
                      disabled={!canAfford}
                    >
                      {palette.cost === 0 ? 'Free' : `${palette.cost} Tokens`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
