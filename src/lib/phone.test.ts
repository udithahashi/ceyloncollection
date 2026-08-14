import { describe, expect, it } from 'vitest';

import {
  countryOf,
  formatPhone,
  InvalidPhoneNumberError,
  isValidPhone,
  maskPhone,
  normalisePhone,
} from './phone';

describe('normalisePhone', () => {
  it('accepts a bare Qatari mobile number', () => {
    expect(normalisePhone('55123456')).toBe('+97455123456');
    expect(normalisePhone('33123456')).toBe('+97433123456');
    expect(normalisePhone('66123456')).toBe('+97466123456');
    expect(normalisePhone('77123456')).toBe('+97477123456');
  });

  it('accepts a Qatari landline', () => {
    expect(normalisePhone('44123456')).toBe('+97444123456');
  });

  it('reads through the punctuation people actually type', () => {
    // Every one of these is the same customer. If any produced a different string
    // they would appear in the list as a separate person with one enquiry each.
    const forms = [
      '+974 5512 3456',
      '+974-5512-3456',
      '974 55123456',
      '00974 55123456',
      '(974) 5512 3456',
      '  55123456  ',
      '5512 3456',
      '5512-3456',
    ];

    for (const form of forms) {
      expect(normalisePhone(form), form).toBe('+97455123456');
    }
  });

  it('reads Arabic-Indic digits from an Arabic keyboard', () => {
    expect(normalisePhone('٥٥١٢٣٤٥٦')).toBe('+97455123456');
    // Extended Arabic-Indic, as used by Persian and Urdu keyboards.
    expect(normalisePhone('۵۵۱۲۳۴۵۶')).toBe('+97455123456');
  });

  it('strips a non-breaking space pasted from a web page', () => {
    expect(normalisePhone('5512\u00a03456')).toBe('+97455123456');
  });

  it('accepts Sri Lankan numbers when told to', () => {
    expect(normalisePhone('0771234567', 'LK')).toBe('+94771234567');
    expect(normalisePhone('771234567', 'LK')).toBe('+94771234567');
    expect(normalisePhone('077 123 4567', 'LK')).toBe('+94771234567');
  });

  it('recognises a Sri Lankan country code even when Qatar is the default', () => {
    // The supplier side of the business is in Sri Lanka, and those numbers get
    // pasted into the same fields.
    expect(normalisePhone('+94771234567')).toBe('+94771234567');
    expect(normalisePhone('0094771234567')).toBe('+94771234567');
  });

  it('keeps a plausible number from a third country', () => {
    // Qatar has a large Indian and Filipino population. Rejecting these would lose
    // real customers, so an explicit international number is taken at its word.
    expect(normalisePhone('+919812345678')).toBe('+919812345678');
    expect(normalisePhone('+639171234567')).toBe('+639171234567');
    expect(normalisePhone('00 44 7700 900123')).toBe('+447700900123');
  });

  it('is idempotent, so re-saving a stored number changes nothing', () => {
    const once = normalisePhone('5512 3456');
    expect(normalisePhone(once)).toBe(once);
  });

  it('refuses an empty or punctuation-only input', () => {
    expect(() => normalisePhone('')).toThrow(InvalidPhoneNumberError);
    expect(() => normalisePhone('   ')).toThrow(InvalidPhoneNumberError);
    expect(() => normalisePhone('--')).toThrow(InvalidPhoneNumberError);
  });

  it('says how many digits are missing rather than just failing', () => {
    expect(() => normalisePhone('5512345')).toThrow(/8 digits.*has 7/s);
  });

  it('rejects a local number with an impossible first digit', () => {
    // No Qatari number starts with 0, 1, 2, 8 or 9.
    expect(() => normalisePhone('95123456')).toThrow(/first digit/);
    expect(() => normalisePhone('15123456')).toThrow(/first digit/);
  });

  it('rejects a long number typed without a country code', () => {
    // Ambiguous: it could be a mistyped local number or a foreign one missing its
    // prefix. Guessing either way would store something wrong under a real
    // customer's identity, so it is refused with instructions.
    expect(() => normalisePhone('9812345678')).toThrow(/country code and a plus/);
  });

  it('rejects a number that is too long to be a phone number at all', () => {
    expect(() => normalisePhone('+1234567890123456')).toThrow(InvalidPhoneNumberError);
  });
});

describe('isValidPhone', () => {
  it('answers without throwing', () => {
    expect(isValidPhone('55123456')).toBe(true);
    expect(isValidPhone('nonsense')).toBe(false);
    expect(isValidPhone('0771234567', 'LK')).toBe(true);
  });
});

describe('formatPhone', () => {
  it('groups a known number for reading', () => {
    expect(formatPhone('+97455123456')).toBe('+974 5512 3456');
    expect(formatPhone('+94771234567')).toBe('+94 77123 4567');
  });

  it('leaves anything it does not recognise alone', () => {
    expect(formatPhone('+919812345678')).toBe('+919812345678');
    expect(formatPhone('not a number')).toBe('not a number');
  });
});

describe('maskPhone', () => {
  it('keeps only the last four digits', () => {
    expect(maskPhone('+97455123456')).toBe('•••• 3456');
  });

  it('gives away nothing when there is nothing to keep', () => {
    expect(maskPhone('')).toBe('••••');
    expect(maskPhone('12')).toBe('••••');
  });
});

describe('countryOf', () => {
  it('names the country of a stored number', () => {
    expect(countryOf('+97455123456')).toBe('QA');
    expect(countryOf('+94771234567')).toBe('LK');
  });

  it('returns null for a country we have no plan for', () => {
    expect(countryOf('+919812345678')).toBeNull();
  });
});
