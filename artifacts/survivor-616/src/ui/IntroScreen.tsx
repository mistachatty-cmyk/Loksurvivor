/**
 * Cold open. Sets the premise before the player ever sees the hideout.
 * Owned by the design pass -- keep the export name and props stable.
 */
import { motion } from 'framer-motion';

export interface IntroScreenProps {
  onBegin: () => void;
}

export function IntroScreen({ onBegin }: IntroScreenProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-8 text-center bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)] pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center max-w-lg w-full"
      >
        <p className="text-primary text-xs uppercase tracking-[0.4em] font-bold mb-6">Grand Rapids · 616</p>
        
        <h1 className="text-6xl md:text-8xl font-black mb-8 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
          616<br/>Survivor
        </h1>
        
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-12 max-w-sm">
          The block turned after dark. You have a basement bar, a crew worth saving, and one night at a time.
        </p>
        
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBegin}
          className="group relative w-full sm:w-auto px-10 py-5 bg-primary text-primary-foreground uppercase tracking-widest font-black text-sm overflow-hidden"
          data-testid="button-begin"
        >
          <div className="absolute inset-0 bg-white translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300 ease-out" />
          <span className="relative z-10 group-hover:text-black transition-colors duration-300">Enter the hideout</span>
        </motion.button>
      </motion.div>
    </div>
  );
}

export default IntroScreen;
