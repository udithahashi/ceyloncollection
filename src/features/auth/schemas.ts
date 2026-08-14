/**
 * Validation schemas for the authentication forms.
 *
 * Kept separate from the actions so they can be unit tested without booting the
 * database, and so a client component can reuse the same rules for inline
 * feedback without pulling server code into the browser bundle.
 */
import { z } from 'zod';

import { roles } from '@/lib/auth/roles';

/**
 * Passwords are checked for length only.
 *
 * Composition rules - "one uppercase, one digit, one symbol" - push people towards
 * `Password1!` and towards writing it down. Length is what actually resists
 * guessing, so the floor is high and there is no ceiling worth mentioning.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters. A short sentence works well.')
  .max(256, 'That is longer than 256 characters.');

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .max(254, 'That email address is too long.')
  .email('Enter a valid email address.')
  // Stored and compared in lower case, so `Sam@x.com` and `sam@x.com` are one
  // account rather than two.
  .transform((value) => value.toLowerCase());

export const signInSchema = z.object({
  email: emailSchema,
  // No length rules on sign-in: the password either matches or it does not, and
  // telling someone their existing password is "too short" is nonsense.
  password: z.string().min(1, 'Enter your password.'),
  next: z.string().optional(),
});

/** A six-digit TOTP code. Spaces are stripped because authenticator apps show `123 456`. */
export const totpCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, ''))
  .pipe(
    z
      .string()
      .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.')
      .describe('totp')
  );

export const twoFactorSchema = z.object({
  code: totpCodeSchema,
  next: z.string().optional(),
});

export const backupCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Enter one of your backup codes.')
    .max(64, 'That is not a backup code.'),
  next: z.string().optional(),
});

export const enableTwoFactorSchema = z.object({
  password: z.string().min(1, 'Confirm your password to continue.'),
});

export const confirmTwoFactorSchema = z.object({
  code: totpCodeSchema,
});

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Enter a name of at least 2 characters.')
  .max(120, 'That name is too long.');

export const inviteSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  role: z.enum(roles, { error: 'Choose a role.' }),
});

export const acceptInviteSchema = z
  .object({
    token: z.string().min(1, 'This invitation link is incomplete.'),
    name: nameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two passwords do not match.',
  });
