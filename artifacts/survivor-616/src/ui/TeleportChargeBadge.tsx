interface TeleportChargeBadgeProps {
  charges: number;
}

/**
 * HUD badge for held Instant Transmission charges. The charge is spent from the
 * pause screen, never automatically, so the player needs a standing reminder
 * that they are carrying one.
 */
export function TeleportChargeBadge({ charges }: TeleportChargeBadgeProps) {
  if (charges <= 0) return null;

  return (
    <div
      className="absolute bottom-3 right-[14.5rem] z-30 flex h-12 w-12 items-center justify-center rounded-full border-[3px] shadow-[0_0_10px_rgba(0,0,0,0.5)]"
      style={{
        borderColor: '#67e8f9',
        background: 'radial-gradient(circle at 35% 30%, #164e5c, #08222b 70%)',
        boxShadow: '0 0 0 1px rgba(103,232,249,0.35) inset, 0 0 12px rgba(0,0,0,0.5)',
      }}
      data-testid="indicator-teleport-charges"
      title="Instant Transmission held — spend it from the pause screen."
    >
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <ellipse cx="11" cy="11" rx="9" ry="3.5" fill="none" stroke="#67e8f9" strokeWidth="1.4" />
        <ellipse cx="11" cy="11" rx="3.5" ry="9" fill="none" stroke="#a5f3fc" strokeWidth="1.2" />
        <circle cx="11" cy="11" r="2.4" fill="#ecfeff" />
      </svg>
      <span className="absolute -bottom-1 -right-1 rounded-full border border-cyan-200/70 bg-[#08222b] px-1 font-mono text-[9px] font-bold text-cyan-100">
        {charges}
      </span>
    </div>
  );
}

export default TeleportChargeBadge;
