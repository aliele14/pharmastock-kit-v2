import type { ReactNode } from 'react';
import { Activity, Info } from 'lucide-react';
import { Nav } from './nav';
import { ThemeToggle } from './theme-toggle';

function SandboxBanner() {
  return (
    <div className="flex items-center gap-2 border-b border-amber-200/60 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>Demo sandbox — you can edit anything; data resets automatically every 24h.</span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Activity className="h-4 w-4" aria-hidden />
            </span>
            <span className="font-semibold tracking-tight text-foreground">PharmaStock</span>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
        <SandboxBanner />
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-border md:block">
          <div className="sticky top-[97px] p-3">
            <Nav orientation="vertical" />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="overflow-x-auto border-b border-border px-3 py-2 md:hidden">
            <Nav orientation="horizontal" />
          </div>
          <div className="mx-auto max-w-7xl p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
