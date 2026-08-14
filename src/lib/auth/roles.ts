/**
 * Roles and permissions.
 *
 * The whole authorisation policy of the application is this one file. It is
 * deliberately a plain data table rather than scattered `if (user.role === ...)`
 * checks, because a permission model you cannot read in one sitting is a
 * permission model nobody audits.
 *
 * Safe to import anywhere, including client components: no database, no secrets.
 */

/**
 * Roles, ordered from most to least privileged.
 *
 * - `owner` you, and anyone you trust with the business itself. Can manage staff.
 * - `manager` runs day-to-day operations including the taxonomy, but cannot
 *   create accounts or change system settings.
 * - `staff` records and works leads. Cannot delete anything, so a mistake is
 *   always recoverable by someone more senior.
 * - `viewer` reads. For a partner or accountant who needs numbers, not access.
 */
export const roles = ['owner', 'manager', 'staff', 'viewer'] as const;

export type Role = (typeof roles)[number];

export const DEFAULT_ROLE: Role = 'staff';

/** Human labels, for the UI. */
export const roleLabels: Record<Role, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
  viewer: 'Viewer',
};

export const roleDescriptions: Record<Role, string> = {
  owner: 'Full access, including staff accounts and system settings.',
  manager: 'Runs operations and the taxonomy. Cannot manage accounts.',
  staff: 'Records and works leads. Cannot delete records.',
  viewer: 'Read-only access to leads, customers and analytics.',
};

/**
 * The things that can be acted upon. Adding a resource here and forgetting to
 * grant it is safe: an ungranted permission is denied.
 */
export const resources = [
  'leads',
  'customers',
  'taxonomy',
  'analytics',
  'imports',
  'users',
  'settings',
  'activityLog',
] as const;

export type Resource = (typeof resources)[number];

/**
 * `read` view it. `create` add new. `update` change existing. `delete` soft-delete.
 * `manage` administer the thing itself, e.g. invite staff or edit system settings.
 */
export const actions = ['read', 'create', 'update', 'delete', 'manage'] as const;

export type Action = (typeof actions)[number];

export type Permission = `${Resource}:${Action}`;

const ALL: readonly Action[] = actions;
const READ_ONLY: readonly Action[] = ['read'];
const READ_WRITE: readonly Action[] = ['read', 'create', 'update'];

/**
 * Who may do what. An action absent from a role's list is denied - the model is
 * a whitelist, so a new resource is inaccessible until someone deliberately
 * grants it.
 */
const grants: Record<Role, Partial<Record<Resource, readonly Action[]>>> = {
  owner: {
    leads: ALL,
    customers: ALL,
    taxonomy: ALL,
    analytics: READ_ONLY,
    imports: ALL,
    users: ALL,
    settings: ALL,
    activityLog: READ_ONLY,
  },
  manager: {
    leads: ALL,
    customers: ALL,
    taxonomy: ALL,
    analytics: READ_ONLY,
    imports: ALL,
    // Deliberately no `users`. A manager who can invite an owner has, in effect,
    // promoted themselves.
    activityLog: READ_ONLY,
  },
  staff: {
    leads: READ_WRITE,
    customers: READ_WRITE,
    taxonomy: READ_ONLY,
    analytics: READ_ONLY,
    imports: READ_ONLY,
  },
  viewer: {
    leads: READ_ONLY,
    customers: READ_ONLY,
    taxonomy: READ_ONLY,
    analytics: READ_ONLY,
  },
};

/**
 * Whether a role may perform an action on a resource.
 *
 * @example
 * if (!can(user.role, 'leads', 'delete')) forbidden();
 */
export function can(role: Role, resource: Resource, action: Action): boolean {
  return grants[role][resource]?.includes(action) ?? false;
}

/** Parses a `resource:action` string, for permission lists in data or config. */
export function canPermission(role: Role, permission: Permission): boolean {
  const [resource, action] = permission.split(':') as [Resource, Action];
  return can(role, resource, action);
}

/** Every permission a role holds. Useful for debugging and for the settings UI. */
export function permissionsFor(role: Role): Permission[] {
  return resources.flatMap((resource) =>
    (grants[role][resource] ?? []).map((action) => `${resource}:${action}` as Permission)
  );
}

/** Whether a value is one of our roles, for validating input from outside. */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (roles as readonly string[]).includes(value);
}

/**
 * Whether `actor` outranks `subject`. Used to stop a manager editing an owner, and
 * to stop anyone granting a role above their own.
 */
export function outranks(actor: Role, subject: Role): boolean {
  return roles.indexOf(actor) < roles.indexOf(subject);
}
