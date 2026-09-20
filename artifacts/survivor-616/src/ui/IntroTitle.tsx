/**
 * Opening-title lockups. The classic stack remains available; the signature
 * lockup gives the “616” half of Survivor616 its own visual weight instead of
 * rendering the name as one cramped text run.
 * Drag state is deliberately session-only: a reset or reload always returns
 * the title to its designed composition.
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface TitlePieceProps {
  children: ReactNode;
  className: string;
  controls: ReturnType<typeof useAnimation>;
  enabled: boolean;
  stageRef: RefObject<HTMLDivElement | null>;
  onMoved: () => void;
}

function TitlePiece({ children, className, controls, enabled, stageRef, onMoved }: TitlePieceProps) {
  return (
    <motion.div
      animate={controls}
      drag={enabled}
      dragConstraints={stageRef}
      dragElastic={0.14}
      dragMomentum
      dragTransition={{ power: 0.26, timeConstant: 260, bounceStiffness: 180, bounceDamping: 20 }}
      onDragStart={onMoved}
      whileHover={enabled ? { scale: 1.015 } : undefined}
      whileTap={enabled ? { scale: 0.985, cursor: 'grabbing' } : undefined}
      className={`${className} ${enabled ? 'cursor-grab touch-none' : ''}`}
      style={enabled ? { touchAction: 'none' } : undefined}
    >
      {children}
    </motion.div>
  );
}

export interface IntroTitleProps {
  /** false preserves the original two-line, centered title. */
  signatureLayout: boolean;
  physicsEnabled: boolean;
}

export function IntroTitle({ signatureLayout, physicsEnabled }: IntroTitleProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const survivorControls = useAnimation();
  const numberControls = useAnimation();
  const [hasMoved, setHasMoved] = useState(false);

  const reset = () => {
    setHasMoved(false);
    void Promise.all([
      survivorControls.start({ x: 0, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 155, damping: 18, mass: 0.8 } }),
      numberControls.start({ x: 0, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 155, damping: 18, mass: 0.8 } }),
    ]);
  };

  useEffect(() => {
    if (!physicsEnabled) {
      survivorControls.set({ x: 0, y: 0, rotate: 0 });
      numberControls.set({ x: 0, y: 0, rotate: 0 });
      setHasMoved(false);
    }
  }, [numberControls, physicsEnabled, survivorControls]);

  const moveHint = physicsEnabled ? 'Drag the title pieces' : undefined;

  return (
    <div className="relative mb-7 w-full" data-testid="intro-title-stage">
      <div
        ref={stageRef}
        className={`relative mx-auto h-40 w-full max-w-[32rem] select-none sm:h-48 ${signatureLayout ? 'md:max-w-[36rem]' : ''}`}
      >
        <h1 className="sr-only">Survivor616</h1>
        <TitlePiece
          controls={survivorControls}
          enabled={physicsEnabled}
          stageRef={stageRef}
          onMoved={() => setHasMoved(true)}
          className={signatureLayout
            ? 'absolute inset-x-0 top-3 text-center text-[clamp(3.2rem,13vw,6.8rem)] font-black uppercase leading-[0.78] tracking-[-0.065em] text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.18)]'
            : 'absolute inset-x-0 top-3 text-center text-[clamp(3.7rem,15vw,7.5rem)] font-black uppercase leading-[0.8] tracking-[-0.07em] text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.18)]'}
        >
          <span title={moveHint}>Survivor</span>
        </TitlePiece>

        <TitlePiece
          controls={numberControls}
          enabled={physicsEnabled}
          stageRef={stageRef}
          onMoved={() => setHasMoved(true)}
          className={signatureLayout
            ? 'absolute left-[59%] top-[5.8rem] border border-cyan-200/80 bg-black/45 px-3 py-1 font-mono text-[clamp(1.75rem,6vw,3.25rem)] font-black leading-none tracking-[-0.1em] text-cyan-200 shadow-[0_0_24px_rgba(103,232,249,0.25)] sm:left-[62%] sm:top-[7.25rem] sm:px-4 sm:py-1.5'
            : 'absolute inset-x-0 top-[5.6rem] text-center font-mono text-[clamp(2.75rem,11vw,5.8rem)] font-black leading-none tracking-[-0.12em] text-cyan-100 drop-shadow-[0_0_20px_rgba(103,232,249,0.38)] sm:top-[6.8rem]'}
        >
          <span title={moveHint}>616</span>
        </TitlePiece>

        {physicsEnabled ? (
          <p className="pointer-events-none absolute inset-x-0 bottom-0 text-center font-mono text-[9px] uppercase tracking-[0.28em] text-white/28 sm:text-[10px]">
            Touch and move the title
          </p>
        ) : null}
      </div>

      {physicsEnabled && hasMoved ? (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: [0.28, 0.52, 0.28], y: 0 }}
          transition={{ opacity: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }, y: { duration: 0.35 } }}
          whileHover={{ opacity: 0.9 }}
          whileTap={{ scale: 0.96 }}
          onClick={reset}
          className="fixed bottom-4 left-4 z-20 border border-white/25 bg-black/50 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white/90 backdrop-blur-sm sm:bottom-6 sm:left-6"
          aria-label="Reset title position"
          data-testid="button-reset-intro-title"
        >
          Reset title
        </motion.button>
      ) : null}
    </div>
  );
}

export default IntroTitle;
