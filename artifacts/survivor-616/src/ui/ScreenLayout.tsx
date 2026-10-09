import { ReactNode, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

import { activeUiThemeSwatchId, useMeta } from '@/game/state/metaStore';
import { dismissVisitTheme, useVisitTheme, visitThemeStyle } from '@/lib/gsixVisitTheme';
import { useT } from '@/lib/i18n';

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
  const visitTheme = useVisitTheme();
  const t = useT();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [title]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={visitTheme ? visitThemeStyle(visitTheme) : undefined}
      data-ui-theme={meta.uiTheme}
      data-ui-swatch={activeUiThemeSwatchId(meta)}
      className={`min-h-[100dvh] bg-background text-foreground flex flex-col relative overflow-hidden ${className}`}
    >
      {backdrop && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-background/90 z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent z-10" />
          {/* Reference art is a *backdrop*, never a document image: painted as a
              CSS background so a stylesheet that fails to load can't leave a
              raw full-bleed photo sitting in the page. See
              .agents/memory/survivor-616-art-assets.md. */}
          <div
            className="h-full w-full bg-cover bg-center opacity-30 mix-blend-luminosity grayscale"
            style={{ backgroundImage: `url(${import.meta.env.BASE_URL}${backdrop})` }}
            aria-hidden="true"
          />
        </div>
      )}

      <header className={`relative z-30 px-6 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 ${onBack ? 'pt-20' : 'pt-10'}`}>
        <div>
          {onBack && (
            <button 
              type="button"
              onClick={onBack} 
              className="group fixed left-3 top-3 z-[110] inline-flex min-h-10 items-center gap-1 border border-white/15 bg-black/65 px-2.5 text-white/60 opacity-75 backdrop-blur transition hover:border-primary hover:text-white hover:opacity-100 uppercase text-[10px] tracking-widest font-bold"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              {t('common.back')}
            </button>
          )}
          {subtitle && <p className="text-primary text-xs uppercase tracking-[0.3em] font-bold mb-2">{subtitle}</p>}
          <h1 className="text-4xl md:text-5xl font-black text-white drop-shadow-md">{title}</h1>
          {visitTheme && (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground" data-testid="text-gsix-visit-theme">
              Wearing your GSix theme ·{' '}
              <button type="button" onClick={dismissVisitTheme} className="font-bold text-primary underline underline-offset-4 hover:text-foreground" data-testid="button-dismiss-gsix-theme">
                Use my Survivor theme
              </button>
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <main className="relative z-20 px-6 pb-16 flex-1 flex flex-col">
        {children}
      </main>
    </motion.div>
  );
}
