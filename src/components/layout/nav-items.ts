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
  href?: '/';
  /** Shown as a hint under the label. */
  description?: string;
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
      { label: 'Leads', icon: Inbox },
      { label: 'Customers', icon: Users },
      { label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    heading: 'Configuration',
    items: [
      { label: 'Taxonomy', icon: Tags },
      { label: 'Team', icon: ShieldCheck },
      { label: 'Settings', icon: Settings },
    ],
  },
];
