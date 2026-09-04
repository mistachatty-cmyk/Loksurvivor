interface HazardImmuneBadgeProps {
  active: boolean;
}

/** Small HUD badge shown for the whole run once "Let Me Hold This" is unlocked, so the absence of hazard self-damage has a visible cause. */
export function HazardImmuneBadge({ active }: HazardImmuneBadgeProps) {
  if (!active) return null;

  return (
    <div
      className="absolute bottom-3 right-44 z-30 flex h-12 w-12 items-center justify-center rounded-full border-[3px] shadow-[0_0_10px_rgba(0,0,0,0.5)]"
      style={{
        borderColor: '#5cd6c0',
        background: 'radial-gradient(circle at 35% 30%, #1c4a42, #0f2b26 70%)',
        boxShadow: '0 0 0 1px rgba(92,214,192,0.35) inset, 0 0 10px rgba(0,0,0,0.5)',
      }}
      data-testid="indicator-hazard-immune"
      title="Hazard immunity — your own hazard weapons can't hurt you."
    >
      <HazardShieldGlyph />
    </div>
  );
}

function HazardShieldGlyph() {
  return (
    <svg width="20" height="22" viewBox="0 0 20 22" aria-hidden="true">
      <path d="M10 1 L18 4.5 V10.5 C18 15.5 14.5 19 10 21 C5.5 19 2 15.5 2 10.5 V4.5 Z" fill="#123833" stroke="#5cd6c0" strokeWidth="1.4" />
      <path d="M5.5 11.5 L8.5 14.5 L14.5 7" fill="none" stroke="#8bf0dc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default HazardImmuneBadge;
