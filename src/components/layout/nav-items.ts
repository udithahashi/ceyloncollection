import {
  BarChart3,
  Inbox,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { canPermission, type Permission, type Role } from '@/lib/auth/roles';

/**
 * The back office navigation, as data.
 *
 * Sections that have not been built yet appear without an `href` and render as
 * inert, greyed rows rather than being hidden. Showing the shape of the finished
 * tool makes the thing feel coherent while it is half-built, and a visible
 * "soon" is more honest than a link that 404s.
 */
export type NavItem = {
  label: string;
  icon: LucideIcon;
  /**
   * Typed as the literal routes that exist. Next.js checks <Link href> against
   * the real route tree, so this widens by itself as pages are added - and a
   * typo becomes a type error rather than a broken link.
   */
  href?: '/' | '/team';
  /** Shown as a hint under the label. */
  description?: string;
  /**
   * Hides the item from roles that lack this permission.
   *
   * Hiding is courtesy, not security: the page and its actions check for
   * themselves. Showing a viewer a Team link that refuses them on arrival is just
   * a worse interface.
   */
  permission?: Permission;
};

export type NavSection = {
  heading: string;
  items: readonly NavItem[];
};

/*
 * Annotated rather than `as const satisfies`: the latter narrows each item to its
 * own literal type, and half of those literals have no `href` property at all, so
 * `item.href` stops type-checking. The annotation keeps every item the same shape
 * with `href` optional, which is what the nav actually branches on.
 */
export const navSections: readonly NavSection[] = [
  {
    heading: 'Overview',
    items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/' }],
  },
  {
    heading: 'Demand',
    items: [
      { label: 'Leads', icon: Inbox, permission: 'leads:read' },
      { label: 'Customers', icon: Users, permission: 'customers:read' },
      { label: 'Analytics', icon: BarChart3, permission: 'analytics:read' },
    ],
  },
  {
    heading: 'Configuration',
    items: [
      { label: 'Taxonomy', icon: Tags, permission: 'taxonomy:read' },
      { label: 'Team', icon: ShieldCheck, href: '/team', permission: 'users:manage' },
      { label: 'Settings', icon: Settings, permission: 'settings:read' },
    ],
  },
];

/**
 * The sections a role should see, with empty sections dropped.
 *
 * A heading with nothing under it looks like a rendering bug, which is why the
 * filter removes the section rather than just its items.
 */
export function navSectionsFor(role: Role): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => item.permission === undefined || canPermission(role, item.permission)
      ),
    }))
    .filter((section) => section.items.length > 0);
}
