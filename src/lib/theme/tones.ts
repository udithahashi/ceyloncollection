/**
 * The semantic tones a status can wear.
 *
 * This list lives on its own, apart from the Badge component, because two very
 * different places need to agree on it: the `Badge` variants that render a tone,
 * and the CHECK constraints on the taxonomy tables that store one. If they ever
 * disagreed, a status row could hold `purple` and simply render as nothing.
 */
export const badgeTones = ['neutral', 'accent', 'success', 'warning', 'error', 'info'] as const;

export type BadgeTone = (typeof badgeTones)[number];

export function isBadgeTone(value: unknown): value is BadgeTone {
  return typeof value === 'string' && (badgeTones as readonly string[]).includes(value);
}
