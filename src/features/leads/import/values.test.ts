import { describe, expect, it } from 'vitest';

import { fingerprintText, readDay, readFlag, readList, readQuantity } from './values';

function day(raw: string): string | null {
  const read = readDay(raw);
  return read.ok ? read.value : null;
}

describe('readDay', () => {
  it('reads an ISO date', () => {
    expect(day('2026-03-09')).toBe('2026-03-09');
  });

  it('reads a day-first date with slashes, dashes or dots', () => {
    expect(day('09/03/2026')).toBe('2026-03-09');
    expect(day('9-3-2026')).toBe('2026-03-09');
    expect(day('09.03.2026')).toBe('2026-03-09');
  });

  it('reads a two-digit year as this century', () => {
    expect(day('09/03/26')).toBe('2026-03-09');
  });

  it('reads a slash date day first even when it could be either', () => {
    // The one deliberate ambiguity in the whole importer. 03/04 is the third of April
    // here, as it is in Qatar and in Sri Lanka, and the report shows the interpretation
    // so it can be checked.
    expect(day('03/04/2026')).toBe('2026-04-03');
  });

  it('reads an Excel serial number', () => {
    // 46090 is 2026-03-09 counted from Excel's 1899-12-30 epoch. The epoch checks out
    // against the well-known serial 43831 for 2020-01-01.
    expect(day('46090')).toBe('2026-03-09');
  });

  it('refuses a number that is not a plausible serial', () => {
    expect(readDay('12345').ok).toBe(false);
  });

  it('refuses a date that does not exist', () => {
    expect(readDay('31/02/2026').ok).toBe(false);
    expect(readDay('2026-13-01').ok).toBe(false);
  });

  it('refuses a year outside this century, which is always a typo', () => {
    expect(readDay('09/03/1926').ok).toBe(false);
  });

  it('says what it could not read, quoting the cell', () => {
    const read = readDay('last tuesday');

    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.message).toContain('last tuesday');
  });
});

describe('readQuantity', () => {
  it('reads a bare number', () => {
    expect(readQuantity('3')).toEqual({ ok: true, value: 3 });
  });

  it('reads a number with a unit written after it', () => {
    expect(readQuantity('2 pcs')).toEqual({ ok: true, value: 2 });
    expect(readQuantity('2 pieces')).toEqual({ ok: true, value: 2 });
  });

  it('refuses a range, because nobody can tell which end was meant', () => {
    expect(readQuantity('2-3').ok).toBe(false);
  });

  it('refuses words', () => {
    expect(readQuantity('a few').ok).toBe(false);
  });
});

describe('readFlag', () => {
  it('reads the many ways a spreadsheet says yes and no', () => {
    for (const yes of ['Yes', 'y', 'TRUE', '1', 'x']) expect(readFlag(yes), yes).toBe(true);
    for (const no of ['No', 'n', 'false', '0', '-', 'N/A']) expect(readFlag(no), no).toBe(false);
  });

  it('reads anything else as no answer, so the caller can look again', () => {
    // The WhatsApp column carries either an answer or a phone number.
    expect(readFlag('33124455')).toBeNull();
  });
});

describe('readList', () => {
  it('splits on whichever separator was used', () => {
    expect(readList('Batik; Maxi | Casual/Daily\nPockets')).toEqual([
      'Batik',
      'Maxi',
      'Casual/Daily',
      'Pockets',
    ]);
  });

  it('drops blanks and repeats, keeping the first spelling', () => {
    expect(readList('Batik, , batik')).toEqual(['Batik']);
  });
});

describe('fingerprintText', () => {
  it('ignores case and spacing, since neither makes it a different enquiry', () => {
    expect(fingerprintText('  Two  batik   frocks ')).toBe(fingerprintText('two batik frocks'));
  });

  it('treats nothing said as its own value', () => {
    expect(fingerprintText(null)).toBe('');
  });
});
