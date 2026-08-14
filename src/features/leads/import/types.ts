/**
 * The shape of an import report.
 *
 * Its own module, and importing nothing, because the report crosses the boundary: the
 * server builds it, a Server Action returns it, and a client component renders it.
 *
 * The verdicts are the design. An importer that answers "873 rows imported, 41 errors"
 * is an importer nobody trusts twice; this one says which line, what it read, what it
 * could not place, and what it will skip because we already have it - before writing
 * anything at all.
 */
import type { ImportField } from './columns';

export type RowVerdict =
  /** Will be imported. */
  | 'ready'
  /** A row earlier in the same file says the same thing. */
  | 'duplicate'
  /** We already have this enquiry, so importing it again would double-count demand. */
  | 'present'
  /** Something in the row could not be read or placed. */
  | 'rejected';

export interface RowProblem {
  /** The column it belongs to, for pointing at the right heading. */
  field: ImportField | null;
  message: string;
}

/** What a row will become, in words, for the preview table. */
export interface RowPreview {
  phone: string | null;
  name: string | null;
  day: string | null;
  platform: string | null;
  status: string | null;
  interest: string | null;
  quantity: number | null;
  tags: number;
  newCustomer: boolean;
}

export interface PlannedRow {
  /** The line in the file, as an editor numbers them. */
  line: number;
  verdict: RowVerdict;
  problems: RowProblem[];
  preview: RowPreview;
}

/** A value that did not match anything in the taxonomy it belongs to. */
export interface UnplacedValue {
  /** The taxonomy's name, as it appears under Settings. */
  taxonomy: string;
  /** Where to add it. */
  href: string;
  value: string;
  rows: number;
}

export interface ImportSummary {
  rows: number;
  ready: number;
  duplicate: number;
  present: number;
  rejected: number;
  /** Distinct phone numbers we have never seen before. */
  newCustomers: number;
  returningCustomers: number;
  earliestDay: string | null;
  latestDay: string | null;
}

export interface ColumnReport {
  heading: string;
  field: ImportField | null;
  /** Why the column is ignored, when it is one the system computes for itself. */
  derived: string | null;
}

export interface ImportPlan {
  columns: ColumnReport[];
  unrecognised: string[];
  missingRequired: ImportField[];
  summary: ImportSummary;
  rows: PlannedRow[];
  unplaced: UnplacedValue[];
  /** Set when the file was longer than one import may carry. */
  truncated: boolean;
  /** How the columns were separated, worth saying when a file reads as one column. */
  delimiter: string;
  /**
   * The file itself, handed back so that confirming can re-read it.
   *
   * A file input cannot be refilled by JavaScript, so the alternative is asking for the
   * file twice. The commit step re-plans this text from scratch rather than trusting the
   * report: what the browser returns is input like any other.
   */
  csv: string;
}

/** What the commit step reports back, which is what actually happened. */
export interface ImportOutcome {
  imported: number;
  skipped: number;
  rejected: number;
  newCustomers: number;
}
