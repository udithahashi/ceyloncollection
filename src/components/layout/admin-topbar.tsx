import { ChevronDown, Menu } from 'lucide-react';

import type { SessionUser } from '@/lib/auth/session';
import type { AdminThemeName } from '@/lib/theme/tokens';

import { AccountMenu } from './account-menu';
import { AdminNav } from './admin-nav';
import { BrandMark } from './brand-mark';
import { ThemeToggle } from './theme-toggle';

/**
 * The top bar: mobile navigation on the left, theme and account on the right.
 */
export function AdminTopbar({ theme, user }: { theme: AdminThemeName; user: SessionUser }) {
  return (
    <header className="relative flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line-subtle bg-surface-panel px-4 lg:px-8">
      {/*
        A native <details> disclosure rather than a JavaScript drawer. The browser
        gives us the open/close state, keyboard support and the correct
        aria-expanded for free, and the menu works on the very first paint.
      */}
      <details className="group lg:hidden">
        <summary
          className="flex h-10 cursor-pointer list-none items-center gap-2 px-2 label-caps text-ink-secondary transition-colors hover:text-ink-primary [&::-webkit-details-marker]:hidden"
          aria-label="Main menu"
        >
          <Menu aria-hidden="true" className="size-4" />
          Menu
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 transition-transform group-open:rotate-180"
          />
        </summary>

        <div className="absolute inset-x-0 top-full z-40 max-h-[70vh] overflow-y-auto border-b border-line-subtle bg-surface-sidebar py-5 shadow-lg">
          <AdminNav role={user.role} />
        </div>
      </details>

      <BrandMark className="text-ink-primary lg:hidden" />

      {/* Placeholder for breadcrumbs, which arrive with the nested pages. */}
      <div className="hidden lg:block" />

      <div className="flex items-center gap-2">
        <ThemeToggle current={theme} />
        <AccountMenu user={user} />
      </div>
    </header>
  );
}
