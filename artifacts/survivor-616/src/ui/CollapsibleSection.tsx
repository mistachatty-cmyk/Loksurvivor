/**
 * Header + toggle wrapper for a Hideout section. Content unmounts while
 * collapsed so a minimized generators/rumor/board section costs nothing --
 * this is purely a mobile-scroll affordance, not a hide-and-remember-state
 * feature per section (that lives one level up, in the default the caller
 * passes).
 */
import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  defaultCollapsed: boolean;
  testId: string;
  children: ReactNode;
}

export function CollapsibleSection({ title, subtitle, icon, defaultCollapsed, testId, children }: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div data-testid={testId} data-collapsed={collapsed}>
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-3 border border-border/70 bg-black/25 px-3 py-2.5 text-left transition-colors hover:border-primary/50"
        data-testid={`${testId}-toggle`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-widest text-white">{title}</span>
            {subtitle && <span className="block truncate text-[10px] text-muted-foreground">{subtitle}</span>}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${collapsed ? '' : 'rotate-180'}`} aria-hidden="true" />
      </button>
      {!collapsed && <div className="border border-t-0 border-border/70 bg-black/10 p-3">{children}</div>}
    </div>
  );
}

export default CollapsibleSection;
