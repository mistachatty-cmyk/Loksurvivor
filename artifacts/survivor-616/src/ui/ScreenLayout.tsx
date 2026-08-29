import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

import { activeUiThemeSwatchId, useMeta } from '@/game/state/metaStore';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: ReactNode;
  action?: ReactNode;
  backdrop?: string;
  className?: string;
}

export function ScreenLayout({ title, subtitle, onBack, children, action, backdrop, className = '' }: Props) {
  const { meta } = useMeta();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-ui-theme={meta.uiTheme}
      data-ui-swatch={activeUiThemeSwatchId(meta)}
      className={`min-h-[100dvh] bg-background text-foreground flex flex-col relative overflow-hidden ${className}`}
    >
      {backdrop && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-background/90 z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent z-10" />
          <img src={`${import.meta.env.BASE_URL}${backdrop}`} className="w-full h-full object-cover opacity-30 mix-blend-luminosity grayscale" alt="" />
        </div>
      )}

      <header className="relative z-20 px-6 pt-10 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          {onBack && (
            <button 
              type="button"
              onClick={onBack} 
              className="group flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6 uppercase text-xs tracking-widest font-bold" 
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back
            </button>
          )}
          {subtitle && <p className="text-primary text-xs uppercase tracking-[0.3em] font-bold mb-2">{subtitle}</p>}
          <h1 className="text-4xl md:text-5xl font-black text-white drop-shadow-md">{title}</h1>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <main className="relative z-20 px-6 pb-16 flex-1 flex flex-col">
        {children}
      </main>
    </motion.div>
  );
}
