'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

import { navSections } from './nav-items';

/**
 * The navigation list.
 *
 * A client component only because it needs the current path to mark the active
 * item. That highlight is set with `aria-current="page"` as well as colour, so it
 * is available to a screen reader and does not depend on seeing the gold bar.
 */
export function AdminNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className={cn('flex flex-col gap-7', className)}>
      {navSections.map((section) => (
        <div key={section.heading} className="flex flex-col gap-1">
          <h2 className="px-4 pb-2 eyebrow text-[0.6rem] text-ink-on-sidebar-muted">
            {section.heading}
          </h2>

          <ul className="flex flex-col">
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.href !== undefined && pathname === item.href;

              const shared = cn(
                'flex items-center gap-3 border-l-2 px-4 py-2.5 text-sm',
                'transition-colors duration-150 ease-out'
              );

              return (
                <li key={item.label}>
                  {item.href === undefined ? (
                    // Not a link and not a button: there is nothing to activate
                    // yet, so it must not be focusable or announced as clickable.
                    <span
                      className={cn(
                        shared,
                        'cursor-default border-transparent text-ink-on-sidebar-muted opacity-60'
                      )}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      <span className="eyebrow text-[0.55rem] text-ink-on-sidebar-muted">Soon</span>
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        shared,
                        isActive
                          ? // The gold bar is brand, not information: the changed
                            // background and aria-current both say "active" too.
                            'border-brand-gold bg-surface-sidebar-active text-ink-on-sidebar'
                          : 'border-transparent text-ink-on-sidebar-muted hover:bg-surface-sidebar-active hover:text-ink-on-sidebar'
                      )}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
