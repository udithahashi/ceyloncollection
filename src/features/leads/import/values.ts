/**
 * Reading a spreadsheet cell as a value.
 *
 * Each reader returns either a value or a message written for the person who typed the
 * cell. Nothing here throws and nothing guesses silently: where a cell is genuinely
 * ambiguous the import stops and asks, because a lead dated six months wrong is worse
 * than a lead not imported.
 *
 * Pure: no environment, no clock, no database.
 */

export type Read<T> = { ok: true; value: T } | { ok: false; message: string };

function good<T>(value: T): Read<T> {
  return { ok: true, value };
}

function bad<T>(message: string): Read<T> {
  return { ok: false, message };
}

/**
 * A calendar day, as `YYYY-MM-DD`.
 *
 * Slash and dot dates are read **day first**: this is a Qatari business importing from
 * Sri Lanka, and both write 03/04 for the third of April. Month-first would silently
 * move a third of all dates, so it is not offered - a sheet in American order has to be
 * reformatted, and the preview shows the interpretation so that a mistake is visible
 * before anything is written.
 */
export function readDay(raw: string): Read<string> {
  const value = raw.trim();

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(value);
  if (iso) return assemble(iso[1]!, iso[2]!, iso[3]!, value);

  const dayFirst = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(value);
  if (dayFirst) {
    const year = dayFirst[3]!.length === 2 ? `20${dayFirst[3]}` : dayFirst[3]!;
    return assemble(year, dayFirst[2]!, dayFirst[1]!, value);
  }

  const serial = readExcelSerial(value);
  if (serial !== null) return good(serial);

  return bad(`"${value}" is not a date. Write it as 2026-03-09 or 09/03/2026.`);
}

function assemble(year: string, month: string, day: string, original: string): Read<string> {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);

  if (m < 1 || m > 12) return bad(`"${original}" has no month ${m}.`);
  if (d < 1 || d > daysInMonth(y, m)) return bad(`"${original}" is not a real date.`);

  // Not "is this plausible" but "is this this century": a year of 1900 or 2600 is a
  // typo that would sit at the far end of every chart's axis.
  if (y < 2000 || y > 2100) return bad(`"${original}" has a year of ${y}.`);

  return good(`${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/**
 * A date left as an Excel serial number, which happens when the column was formatted
 * as General before it was saved.
 *
 * Excel counts days from 1899-12-30, an epoch it inherited from a deliberate leap-year
 * bug in Lotus 1-2-3. Only a range covering roughly 2010 to 2070 is accepted, so an
 * ordinary number in a date column still reads as an error.
 */
function readExcelSerial(value: string): string | null {
  if (!/^\d{5}$/.test(value)) return null;

  const serial = Number(value);
  if (serial < 40000 || serial > 62000) return null;

  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + serial * 86_400_000);

  return date.toISOString().slice(0, 10);
}

/** Pieces wanted. `2`, `2 pcs` and `2 pieces` all mean two. */
export function readQuantity(raw: string): Read<number> {
  const digits = /^(\d+)\s*(?:pcs?|pieces?|nos?|units?)?$/i.exec(raw.trim());

  if (!digits) return bad(`"${raw.trim()}" is not a number of pieces.`);

  return good(Number(digits[1]));
}

const AFFIRMATIVE = new Set(['yes', 'y', 'true', '1', 'on', 'x', '✓', 'yeah', 'ya', 'available']);
const NEGATIVE = new Set(['no', 'n', 'false', '0', 'off', '-', 'none', 'na', 'n/a']);

/**
 * A yes/no cell, or nothing when the cell says something else.
 *
 * Returns `null` rather than an error because the WhatsApp column carries either an
 * answer or a phone number, and the caller decides which it is looking at.
 */
export function readFlag(raw: string): boolean | null {
  const value = raw.trim().toLowerCase();

  if (AFFIRMATIVE.has(value)) return true;
  if (NEGATIVE.has(value)) return false;

  return null;
}

/**
 * A list in one cell.
 *
 * Commas first, then semicolons, then pipes, then newlines - whichever the writer used.
 * Blank entries are dropped, and so are duplicates, since `Batik, batik` is one tag.
 */
export function readList(raw: string): string[] {
  const parts = raw
    .split(/[,;|\n]/)
    .map((part) => part.trim())
    .filter((part) => part !== '');

  const seen = new Map<string, string>();
  for (const part of parts) {
    const key = part.toLowerCase();
    if (!seen.has(key)) seen.set(key, part);
  }

  return [...seen.values()];
}

/**
 * The text used to decide whether two enquiries are the same one.
 *
 * Case and spacing are noise here: the same request retyped with two spaces must not
 * import twice. Only used for comparison, never stored.
 */
export function fingerprintText(value: string | null): string {
  return value === null ? '' : value.toLowerCase().replace(/\s+/g, ' ').trim();
}
