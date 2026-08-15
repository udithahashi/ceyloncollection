/**
 * Human labels for `ActivityAction`. A `Record` over the full union rather than a
 * string transform, so a new action added to the schema without a label here is a
 * type error - the same enforcement `@/lib/theme/tokens` uses for design tokens.
 */
import type { ActivityAction } from '@/db/schema/activity-log';

export const activityActionLabels: Record<ActivityAction, string> = {
  'auth.signIn': 'Signed in',
  'auth.signInFailed': 'Failed sign-in',
  'auth.signOut': 'Signed out',
  'auth.twoFactorEnabled': 'Enabled two-factor',
  'auth.twoFactorFailed': 'Failed two-factor check',
  'auth.passwordChanged': 'Changed password',
  'user.invited': 'Invited a teammate',
  'user.inviteRevoked': 'Revoked an invitation',
  'user.inviteAccepted': 'Accepted an invitation',
  'user.roleChanged': 'Changed a role',
  'user.disabled': 'Disabled an account',
  'user.enabled': 'Enabled an account',
  'lead.created': 'Recorded a lead',
  'lead.updated': 'Updated a lead',
  'lead.deleted': 'Deleted a lead',
  'lead.restored': 'Restored a lead',
  'lead.imageAdded': 'Added a photo',
  'lead.imageRemoved': 'Removed a photo',
  'customer.updated': 'Updated a customer',
  'customer.merged': 'Merged customers',
  'taxonomy.created': 'Added a taxonomy value',
  'taxonomy.updated': 'Updated a taxonomy value',
  'taxonomy.deleted': 'Deleted a taxonomy value',
  'taxonomy.reordered': 'Reordered a taxonomy list',
  'taxonomy.retired': 'Retired a taxonomy value',
  'taxonomy.restored': 'Restored a taxonomy value',
  'import.completed': 'Imported a spreadsheet',
  'intake.received': 'Received an automated message',
  'intake.promoted': 'Promoted an automated message',
  'intake.rejected': 'Dismissed an automated message',
  'settings.updated': 'Updated settings',
};
