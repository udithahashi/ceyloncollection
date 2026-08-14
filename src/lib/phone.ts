/**
 * Phone numbers.
 *
 * The phone number is the customer's identity: two enquiries from the same number
 * are the same person, and that is the whole basis of "is this a repeat customer",
 * which is the figure the business is actually trying to learn. So the number has
 * to be stored in exactly one form, and every route in - the form, the CSV import,
 * the n8n intake - has to produce that same form.
 *
 * The stored form is E.164: a plus sign, a country code, then digits, no spaces or
 * dashes. `+97455123456`. The same number typed as `5512 3456`, `+974 5512-3456`
 * or `00974 55123456` must all arrive as the same string, or the customer is
 * silently split into three.
 *
 * WHY NOT libphonenumber
 * Google's library is ~500KB and knows every numbering plan on earth. This business
 * has customers in Qatar and suppliers in Sri Lanka. Two country rules, written out
 * below and tested, are less code than the import statement - and when a number is
 * rejected, the message can say what is actually wrong with it.
 *
 * A number that does not fit either plan is still accepted if it looks like a
 * plausible international number, because turning away a real customer's Indian or
 * Filipino number would be worse than storing one we cannot fully validate.
 */

/** Where a bare local number is assumed to belong. Qatar is where the customers are. */
export const DEFAULT_COUNTRY = 'QA';

export type KnownCountry = 'QA' | 'LK';

interface Plan {
  /** Country calling code, without the plus. */
  code: string;
  /** How many digits follow the country code. */
  nationalLength: number;
  /**
   * The digits a national number may start with. Qatar mobiles are 3, 5, 6 or 7;
   * landlines start with 4. Sri Lankan mobiles are 7x, landlines 1-9.
   */
  leadingDigits: RegExp;
  /** Stripped when the number is written in national form, e.g. Sri Lanka's 0. */
  trunkPrefix?: string;
  label: string;
}

const PLANS: Record<KnownCountry, Plan> = {
  QA: {
    code: '974',
    nationalLength: 8,
    leadingDigits: /^[3-7]/,
    label: 'Qatar',
  },
  LK: {
    code: '94',
    nationalLength: 9,
    leadingDigits: /^[1-9]/,
    trunkPrefix: '0',
    label: 'Sri Lanka',
  },
};

/** The shortest and longest a number can be in E.164, by the standard. */
const E164_MIN_DIGITS = 8;
const E164_MAX_DIGITS = 15;

export class InvalidPhoneNumberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPhoneNumberError';
  }
}

/**
 * Everything that is not a digit or a leading plus.
 *
 * Deliberately generous about what it strips: people paste numbers with spaces,
 * brackets, dashes, non-breaking spaces from a web page, and the Arabic-Indic
 * digits an Arabic keyboard produces.
 */
function toDigits(input: string): { digits: string; hadPlus: boolean } {
  const arabicIndic = /[\u0660-\u0669\u06f0-\u06f9]/g;

  const western = input.replace(arabicIndic, (digit) => {
    const code = digit.codePointAt(0) ?? 0;
    // Both Arabic-Indic ranges are contiguous and start at zero.
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });

  const trimmed = western.trim();
  const hadPlus = trimmed.startsWith('+') || trimmed.startsWith('00');

  return { digits: trimmed.replace(/\D/g, ''), hadPlus };
}

/**
 * Just the digits of whatever was typed.
 *
 * For searching. A stored number is E.164 and a searched one is however it was pasted,
 * so both sides have to be reduced to digits before they can be compared - otherwise
 * "5512 3456" fails to find `+97455123456`.
 *
 * Not for storing: use `normalisePhone` for that, which also decides the country code.
 */
export function digitsOf(input: string): string {
  const { digits } = toDigits(input);
  return digits;
}

/**
 * Turns anything a person might type into E.164, or explains why it cannot.
 *
 * @param input what was typed or pasted
 * @param country which numbering plan a bare local number belongs to
 *
 * @example
 * normalisePhone('5512 3456')        // '+97455123456'
 * normalisePhone('00974 55123456')   // '+97455123456'
 * normalisePhone('077 123 4567', 'LK') // '+94771234567'
 */
export function normalisePhone(input: string, country: KnownCountry = DEFAULT_COUNTRY): string {
  const { digits, hadPlus } = toDigits(input);

  if (digits === '') {
    throw new InvalidPhoneNumberError('Enter a phone number.');
  }

  // `00` is how the rest of the world writes `+`. Strip it before anything else, or
  // an international number typed that way looks like a very long local one.
  const withoutIdd = digits.startsWith('00') ? digits.slice(2) : digits;

  const plan = PLANS[country];

  // Already carries its own country code.
  for (const candidate of Object.values(PLANS)) {
    if (withoutIdd.startsWith(candidate.code)) {
      const national = withoutIdd.slice(candidate.code.length);

      if (national.length === candidate.nationalLength && candidate.leadingDigits.test(national)) {
        return `+${candidate.code}${national}`;
      }
    }
  }

  // A bare national number, with or without a trunk prefix.
  const national =
    plan.trunkPrefix !== undefined && withoutIdd.startsWith(plan.trunkPrefix)
      ? withoutIdd.slice(plan.trunkPrefix.length)
      : withoutIdd;

  if (national.length === plan.nationalLength) {
    if (!plan.leadingDigits.test(national)) {
      throw new InvalidPhoneNumberError(
        `That does not look like a ${plan.label} number - check the first digit.`
      );
    }

    return `+${plan.code}${national}`;
  }

  // Neither plan fits. Accept it as an international number if it is a plausible
  // length and was clearly written as one, rather than losing a real customer.
  if (hadPlus && withoutIdd.length >= E164_MIN_DIGITS && withoutIdd.length <= E164_MAX_DIGITS) {
    return `+${withoutIdd}`;
  }

  throw new InvalidPhoneNumberError(
    national.length < plan.nationalLength
      ? `A ${plan.label} number has ${plan.nationalLength} digits. That one has ${national.length}.`
      : `That is ${national.length} digits, which is too long for a ${plan.label} number. ` +
          'For a number from another country, start it with the country code and a plus.'
  );
}

/** Whether a string can be stored. Useful where a message is not wanted. */
export function isValidPhone(input: string, country: KnownCountry = DEFAULT_COUNTRY): boolean {
  try {
    normalisePhone(input, country);
    return true;
  } catch {
    return false;
  }
}

/**
 * E.164 grouped for reading: `+974 5512 3456`.
 *
 * Display only. Never store this, never compare on it.
 */
export function formatPhone(e164: string): string {
  const match = /^\+(\d+)$/.exec(e164);
  if (!match) return e164;

  const digits = match[1] ?? '';

  for (const plan of Object.values(PLANS)) {
    if (digits.startsWith(plan.code) && digits.length === plan.code.length + plan.nationalLength) {
      const national = digits.slice(plan.code.length);
      const half = Math.ceil(national.length / 2);

      return `+${plan.code} ${national.slice(0, half)} ${national.slice(half)}`;
    }
  }

  return e164;
}

/**
 * The last four digits, for a log or a support conversation.
 *
 * A full number in a log is personal data sitting somewhere it will be forgotten
 * about; four digits is enough for a human to confirm they are looking at the right
 * customer.
 */
export function maskPhone(e164: string): string {
  const tail = e164.slice(-4);
  return tail.length === 4 ? `•••• ${tail}` : '••••';
}

/** The country a stored number belongs to, when it is one we know. */
export function countryOf(e164: string): KnownCountry | null {
  const digits = e164.replace(/\D/g, '');

  for (const [country, plan] of Object.entries(PLANS) as [KnownCountry, Plan][]) {
    if (digits.startsWith(plan.code) && digits.length === plan.code.length + plan.nationalLength) {
      return country;
    }
  }

  return null;
}
