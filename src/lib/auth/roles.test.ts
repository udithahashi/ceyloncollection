/**
 * Tests for the permission model.
 *
 * These are the assertions that would otherwise only be checked by a human
 * reading the grant table, which is exactly the sort of thing that quietly stops
 * being true. Several are written as "this role must NOT be able to", because a
 * permission model only fails in the direction of granting too much.
 */
import { describe, expect, it } from 'vitest';

import {
  actions,
  can,
  canPermission,
  isRole,
  outranks,
  permissionsFor,
  resources,
  roleDescriptions,
  roleLabels,
  roles,
  type Role,
} from './roles';

/**
 * Resources nobody may write, however senior they are.
 *
 * `analytics` is derived from the leads: there is nothing there to create or edit,
 * and a grant saying otherwise would be a promise the application cannot keep.
 * `activityLog` is append-only by design - a log an administrator can rewrite is
 * not evidence of anything.
 */
const READ_ONLY_RESOURCES = ['analytics', 'activityLog'] as const;

describe('grants', () => {
  it('gives the owner every action on every resource that can be written', () => {
    for (const resource of resources) {
      if ((READ_ONLY_RESOURCES as readonly string[]).includes(resource)) continue;

      for (const action of actions) {
        expect(can('owner', resource, action), `owner ${resource}:${action}`).toBe(true);
      }
    }
  });

  it('lets nobody write a derived or append-only resource', () => {
    for (const resource of READ_ONLY_RESOURCES) {
      for (const role of roles) {
        expect(can(role, resource, 'read'), `${role} ${resource}:read`).toBe(
          // A viewer has no business in the activity log; everyone can read analytics.
          resource === 'analytics' || role === 'owner' || role === 'manager'
        );

        for (const action of ['create', 'update', 'delete', 'manage'] as const) {
          expect(can(role, resource, action), `${role} must not ${resource}:${action}`).toBe(false);
        }
      }
    }
  });

  it('denies everything for a resource nobody was granted', () => {
    // `settings` is owner-only, so it doubles as a check that absence means denial.
    for (const role of ['manager', 'staff', 'viewer'] as const) {
      expect(can(role, 'settings', 'read')).toBe(false);
    }
  });

  describe('privilege escalation', () => {
    it('lets only the owner manage accounts', () => {
      expect(can('owner', 'users', 'manage')).toBe(true);
      for (const role of ['manager', 'staff', 'viewer'] as const) {
        expect(can(role, 'users', 'manage'), `${role} must not manage users`).toBe(false);
        expect(can(role, 'users', 'create'), `${role} must not create users`).toBe(false);
        expect(can(role, 'users', 'read'), `${role} must not read users`).toBe(false);
      }
    });

    it('never lets a role grant one at or above its own level', () => {
      expect(outranks('owner', 'manager')).toBe(true);
      expect(outranks('manager', 'staff')).toBe(true);
      expect(outranks('staff', 'viewer')).toBe(true);

      expect(outranks('manager', 'owner')).toBe(false);
      expect(outranks('staff', 'manager')).toBe(false);
      expect(outranks('viewer', 'staff')).toBe(false);
    });

    it('does not let a role outrank itself', () => {
      for (const role of roles) {
        expect(outranks(role, role), `${role} must not outrank itself`).toBe(false);
      }
    });
  });

  describe('deletion', () => {
    it('is limited to owner and manager', () => {
      for (const resource of ['leads', 'customers', 'taxonomy'] as const) {
        expect(can('owner', resource, 'delete')).toBe(true);
        expect(can('staff', resource, 'delete'), `staff must not delete ${resource}`).toBe(false);
        expect(can('viewer', resource, 'delete'), `viewer must not delete ${resource}`).toBe(false);
      }
      expect(can('manager', 'leads', 'delete')).toBe(true);
    });
  });

  describe('viewer', () => {
    it('can read but never write anything', () => {
      for (const resource of resources) {
        for (const action of actions) {
          if (action === 'read') continue;
          expect(can('viewer', resource, action), `viewer ${resource}:${action}`).toBe(false);
        }
      }
    });
  });

  describe('staff', () => {
    it('can record and edit leads and customers', () => {
      for (const resource of ['leads', 'customers'] as const) {
        expect(can('staff', resource, 'read')).toBe(true);
        expect(can('staff', resource, 'create')).toBe(true);
        expect(can('staff', resource, 'update')).toBe(true);
      }
    });

    it('cannot change the taxonomy, only choose from it', () => {
      expect(can('staff', 'taxonomy', 'read')).toBe(true);
      expect(can('staff', 'taxonomy', 'create')).toBe(false);
      expect(can('staff', 'taxonomy', 'update')).toBe(false);
    });

    it('cannot run a bulk import, which is a write dressed as a read', () => {
      expect(can('staff', 'imports', 'create')).toBe(false);
    });
  });

  it('never grants a write on the activity log, which is append-only by nature', () => {
    for (const role of roles) {
      for (const action of ['create', 'update', 'delete'] as const) {
        expect(can(role, 'activityLog', action), `${role} activityLog:${action}`).toBe(false);
      }
    }
  });
});

describe('canPermission', () => {
  it('agrees with can() for a resource:action string', () => {
    expect(canPermission('owner', 'leads:delete')).toBe(true);
    expect(canPermission('staff', 'leads:delete')).toBe(false);
  });
});

describe('permissionsFor', () => {
  it('lists every granted permission and nothing else', () => {
    const viewerPermissions = permissionsFor('viewer');

    expect(viewerPermissions).toContain('leads:read');
    expect(viewerPermissions).not.toContain('leads:create');
    expect(viewerPermissions.every((permission) => permission.endsWith(':read'))).toBe(true);
  });

  it('gives the owner everything except writes on the read-only resources', () => {
    const writable = resources.length - READ_ONLY_RESOURCES.length;

    expect(permissionsFor('owner')).toHaveLength(
      writable * actions.length + READ_ONLY_RESOURCES.length
    );
  });

  it('agrees with can() for every role and permission', () => {
    for (const role of roles) {
      const held = new Set(permissionsFor(role));
      for (const resource of resources) {
        for (const action of actions) {
          expect(held.has(`${resource}:${action}`)).toBe(can(role, resource, action));
        }
      }
    }
  });
});

describe('isRole', () => {
  it('accepts our roles', () => {
    for (const role of roles) expect(isRole(role)).toBe(true);
  });

  it('rejects anything else, including near misses', () => {
    for (const value of ['admin', 'Owner', 'OWNER', '', 'superuser', null, undefined, 0, {}]) {
      expect(isRole(value), `${String(value)} must not be a role`).toBe(false);
    }
  });
});

describe('metadata', () => {
  it('labels and describes every role, so the UI cannot show a blank', () => {
    for (const role of roles) {
      expect(roleLabels[role as Role]).toBeTruthy();
      expect(roleDescriptions[role as Role]).toBeTruthy();
    }
  });
});
