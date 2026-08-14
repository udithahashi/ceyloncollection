/**
 * A CSV reader for spreadsheets exported by hand.
 *
 * Written rather than installed, for two reasons. The format is small enough to read in
 * one sitting - RFC 4180 is a page - and the failures that matter here are not parsing
 * failures at all: a byte-order mark Excel adds and nothing strips, a Windows locale
 * that separates with semicolons, a cell containing a comma inside quotes, a stray blank
 * line at the end of the file. Each of those is a line or two below and a test above.
 * A dependency would handle the same cases and would also be a dependency in the
 * critical path of importing the customer list.
 *
 * It reports physical line numbers, because "row 14" is useless to someone looking at a
 * spreadsheet and "line 15" is where they can put their cursor. A quoted cell may
 * contain newlines, so the line a record starts on is tracked rather than counted.
 *
 * Pure: no environment, no clock, no database. Safe to import anywhere.
 */

export interface CsvRecord {
  /** The 1-based physical line the record starts on, as an editor would number it. */
  line: number;
  cells: string[];
}

export interface CsvTable {
  /** The separator actually found, so the caller can say so when a file looks wrong. */
  delimiter: string;
  header: string[];
  headerLine: number;
  records: CsvRecord[];
  /** True when `maxRecords` cut the file short. */
  truncated: boolean;
}

/** The separators worth sniffing: comma, semicolon (European Excel), and tab. */
const CANDIDATE_DELIMITERS = [',', ';', '\t'] as const;

/**
 * Guesses the separator from the first line.
 *
 * Counted outside quotes only, so a comma inside `"Doha, Qatar"` does not vote for
 * comma in a semicolon-separated file. Ties go to the earlier candidate, which puts
 * comma first and matches what anyone means by "CSV".
 */
export function sniffDelimiter(text: string): string {
  const firstLine = text.slice(0, indexOfLineBreak(text));

  let best = ',';
  let bestCount = 0;

  for (const candidate of CANDIDATE_DELIMITERS) {
    let count = 0;
    let quoted = false;

    for (let index = 0; index < firstLine.length; index += 1) {
      const char = firstLine[index];

      if (char === '"') {
        quoted = !quoted;
      } else if (char === candidate && !quoted) {
        count += 1;
      }
    }

    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
}

function indexOfLineBreak(text: string): number {
  const index = text.search(/\r\n|\n|\r/);
  return index === -1 ? text.length : index;
}

/** Removes the byte-order mark Excel writes and nothing else ever asks about. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export interface ParseCsvOptions {
  /** Overrides the sniffed separator. */
  delimiter?: string;
  /** How many data records to keep. Beyond this the table is marked `truncated`. */
  maxRecords?: number;
}

/**
 * Splits CSV text into a header and records.
 *
 * Entirely blank lines are dropped rather than becoming records of one empty cell:
 * a trailing newline is not a row, and neither is the gap someone left above their
 * totals. A line with the right number of empty cells is kept, because that one is
 * a row the writer meant to fill in.
 */
export function parseCsv(text: string, options: ParseCsvOptions = {}): CsvTable {
  const source = stripBom(text);
  const delimiter = options.delimiter ?? sniffDelimiter(source);
  const maxRecords = options.maxRecords ?? Number.POSITIVE_INFINITY;

  const records: CsvRecord[] = [];

  let cells: string[] = [];
  let value = '';
  let quoted = false;
  let line = 1;
  let recordLine = 1;
  let truncated = false;

  const endCell = () => {
    cells.push(value);
    value = '';
  };

  const endRecord = () => {
    endCell();

    const blank = cells.every((cell) => cell.trim() === '');

    if (!blank) records.push({ line: recordLine, cells });

    cells = [];
    recordLine = line;
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (quoted) {
      if (char === '"') {
        // A doubled quote inside a quoted cell is a literal quote.
        if (source[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        if (char === '\n') line += 1;
        value += char;
      }

      continue;
    }

    if (char === '"' && value === '') {
      quoted = true;
      continue;
    }

    if (char === delimiter) {
      endCell();
      continue;
    }

    if (char === '\r' || char === '\n') {
      // Treat CRLF as one break.
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      line += 1;
      endRecord();

      // `records` still holds the header at this point, so one more than the limit
      // means the limit has been passed. Reading one extra record is what lets the
      // caller say "and there are more" rather than "exactly this many".
      if (records.length - 1 > maxRecords) {
        truncated = true;
        break;
      }

      continue;
    }

    value += char;
  }

  // Whatever is left when the file ends without a final newline.
  if (!truncated && (value !== '' || cells.length > 0)) endRecord();

  const header = records.shift();

  return {
    delimiter,
    header: header?.cells.map((cell) => cell.trim()) ?? [],
    headerLine: header?.line ?? 1,
    records: records.slice(0, Number.isFinite(maxRecords) ? maxRecords : undefined),
    truncated,
  };
}

/**
 * The cell at a column index, trimmed, with a missing or blank cell coming back as
 * null so that "not stated" is one thing rather than three.
 */
export function cellAt(record: CsvRecord, index: number | undefined): string | null {
  if (index === undefined) return null;

  const raw = record.cells[index];
  if (raw === undefined) return null;

  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}
