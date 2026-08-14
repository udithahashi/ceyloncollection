'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { Role } from '@/lib/auth/roles';
import { cn } from '@/lib/cn';

import { navSectionsFor } from './nav-items';

/**
 * The navigation list.
 *
 * A client component only because it needs the current path to mark the active
 * item. That highlight is set with `aria-current="page"` as well as colour, so it
 * is available to a screen reader and does not depend on seeing the gold bar.
 *
 * The role only decides what is listed. It is not a permission check - those live
 * on the pages and actions themselves.
 */
export function AdminNav({ role, className }: { role: Role; className?: string }) {
  const pathname = usePathname();
  const sections = navSectionsFor(role);

  return (
    <nav aria-label="Main" className={cn('flex flex-col gap-6', className)}>
      {sections.map((section) => (
        <div key={section.heading} className="flex flex-col gap-0.5">
          <h2 className="px-3 pb-1.5 eyebrow text-xs text-ink-on-sidebar-muted">
            {section.heading}
          </h2>

          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.href !== undefined && pathname === item.href;

              // The inset rounded row of an ordinary dashboard rail, rather than
              // an edge-to-edge band with a brand rule down the side.
              const shared = cn(
                'rounded-control flex items-center gap-2.5 px-3 py-2 text-sm',
                'transition-colors duration-150 ease-out'
              );

              return (
                <li key={item.label}>
                  {item.href === undefined ? (
                    // Not a link and not a button: there is nothing to activate
                    // yet, so it must not be focusable or announced as clickable.
                    <span
                      className={cn(shared, 'cursor-default text-ink-on-sidebar-muted opacity-60')}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-[0.6875rem] text-ink-on-sidebar-muted">Soon</span>
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        shared,
                        isActive
                          ? 'bg-surface-sidebar-active font-medium text-ink-on-sidebar'
                          : 'text-ink-on-sidebar-muted hover:bg-surface-sidebar-active hover:text-ink-on-sidebar'
                      )}
                    >
                      {/* Gold on the active icon is the one piece of brand left in
                       * the rail. It is decoration: the fill, the weight and
                       * aria-current each say "active" on their own. */}
                      <Icon
                        aria-hidden="true"
                        className={cn('size-4 shrink-0', isActive && 'text-brand-gold')}
                      />
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
