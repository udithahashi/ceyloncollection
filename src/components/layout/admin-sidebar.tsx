import type { Role } from '@/lib/auth/roles';
import { env, isProductionDeployment } from '@/lib/env';

import { AdminNav } from './admin-nav';
import { BrandMark } from './brand-mark';

/**
 * The navigation rail, shown from the `lg` breakpoint upward. Below that the same
 * navigation appears in a disclosure in the top bar, so there is one nav model
 * rendered two ways rather than two lists to keep in step.
 */
export function AdminSidebar({ role }: { role: Role }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-line-subtle bg-surface-sidebar lg:flex">
      <div className="flex h-16 items-center border-b border-line-subtle px-5">
        <BrandMark className="text-ink-on-sidebar" />
      </div>

      <div className="flex-1 overflow-y-auto py-6">
        <AdminNav role={role} />
      </div>

      <div className="border-t border-line-subtle px-5 py-4">
        <p className="eyebrow text-[0.55rem] text-ink-on-sidebar-muted">
          {isProductionDeployment ? 'Qatar operations' : `${env.APP_ENV} build`}
        </p>
      </div>
    </aside>
  );
}
