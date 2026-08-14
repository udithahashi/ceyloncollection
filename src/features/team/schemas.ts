/**
 * Validation for the team forms.
 *
 * Every field an invitee or an owner submits passes through here before it reaches
 * the database. Safe to import from client components: schemas only, no server code.
 */
import { z } from 'zod';

import { roles } from '@/lib/auth/roles';

/** Long enough that a passphrase is the natural choice. Matches Better Auth's config. */
export const MIN_PASSWORD_LENGTH = 12;

const email = z
  .string()
  .trim()
  .min(1, 'Enter an email address.')
  .max(254, 'That email address is too long.')
  .email('Enter a valid email address.')
  // Stored lower-case so sign-in is not case sensitive and one person cannot hold
  // two accounts that differ only in capitals.
  .transform((value) => value.toLowerCase());

const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(256, 'That password is too long.');

const name = z.string().trim().min(2, 'Enter a name.').max(120, 'That name is too long.');

const role = z.enum(roles, { message: 'Choose a role.' });

export const inviteSchema = z.object({ email, role });

export const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid('That invitation does not exist.'),
});

export const acceptInvitationSchema = z
  .object({
    token: z.string().min(1, 'That invitation link is not valid.'),
    name,
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Both passwords must match.',
    path: ['confirmPassword'],
  });

export const changeRoleSchema = z.object({
  userId: z.string().uuid('That account does not exist.'),
  role,
});

export const setAccountEnabledSchema = z.object({
  userId: z.string().uuid('That account does not exist.'),
  /** Checkbox semantics: present means enable, absent means disable. */
  enabled: z.coerce.boolean(),
});

export type InviteInput = z.infer<typeof inviteSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
