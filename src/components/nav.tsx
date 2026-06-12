'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarClock, FileText, LayoutDashboard, PackageSearch } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/expiry', label: 'Expiry risk', icon: CalendarClock },
  { href: '/reorder', label: 'Reorder', icon: PackageSearch },
  { href: '/briefing', label: 'Briefing', icon: FileText, soon: true },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function Nav({ orientation = 'vertical' }: { orientation?: 'vertical' | 'horizontal' }) {
  const pathname = usePathname();
  const container = orientation === 'vertical' ? 'flex flex-col gap-1' : 'flex flex-row gap-1';

  return (
    <nav className={container}>
      {NAV_ITEMS.map(({ href, label, icon: Icon, soon }) => {
        const active = !soon && isActive(pathname, href);
        const classes = `flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          active
            ? 'bg-accent/10 text-accent'
            : 'text-muted hover:bg-surface-muted hover:text-foreground'
        }`;

        if (soon) {
          return (
            <span
              key={href}
              aria-disabled
              className="flex cursor-not-allowed items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted/60"
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
              <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                Soon
              </span>
            </span>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={classes}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
