/**
 * Reading a spreadsheet into a plan, without writing anything.
 *
 * This is the whole importer. The commit step is thirty lines of inserts; everything
 * that can go wrong goes wrong here, on purpose, where it can be shown to the person
 * holding the spreadsheet before a single row exists.
 *
 * THE SAME VALIDATION AS THE FORM
 * Each row is assembled into exactly the shape the lead form submits and put through
 * `createLeadSchema`. Not a second set of rules that agrees with the first one today:
 * the same rules. So the phone number is normalised the same way, the 5000-piece typo
 * guard applies, and the length limits are the ones the database will accept.
 *
 * WHAT IT REFUSES TO GUESS
 * A value that does not match a taxonomy row is reported, never created. A sub-category
 * that exists under two categories with no category given is reported, never chosen.
 * An unreadable date is reported, never defaulted to today. Every one of those defaults
 * would be a plausible-looking lie in the demand figures this business will make
 * decisions from.
 *
 * IMPORTING TWICE IS SAFE
 * Every candidate row is fingerprinted - customer, day, sub-category, quantity, request -
 * and compared both against the rest of the file and against the enquiries already
 * recorded. So the natural way to use this (import, notice three unknown fabrics, add
 * them, import the same file again) adds the three rows and skips the rest.
 *
 * SERVER ONLY.
 */
import { db } from '@/db/client';
import { customers } from '@/db/schema/customers';
import { leads } from '@/db/schema/leads';
import { cellAt, parseCsv, type CsvRecord } from '@/lib/csv';
import { APP_TIMEZONE, todayInBusinessTime } from '@/lib/time';
import { and, inArray, isNull, sql } from 'drizzle-orm';

import { isFutureDay } from '../contact-date';
import { createLeadSchema } from '../schemas';
import { mapColumns, type ColumnMap, type ImportField } from './columns';
import { findIn, findSubcategory, importLookups, type ImportLookups, type Lookup } from './lookups';
import type {
  ImportPlan,
  ImportSummary,
  PlannedRow,
  RowProblem,
  RowVerdict,
  UnplacedValue,
} from './types';
import { fingerprintText, readDay, readFlag, readList, readQuantity } from './values';

/**
 * How many rows one import may carry.
 *
 * Not a database limit. The report travels to the browser and back, and a file bigger
 * than this is almost always a mistake - a whole workbook, or the same sheet pasted
 * twice. Splitting it is a better answer than a slow page.
 */
export const MAX_IMPORT_ROWS = 2000;

/** The row as it will be inserted, kept on the server only. */
export interface ResolvedRow {
  line: number;
  fingerprint: string;
  phone: string;
  customerName: string | null;
  whatsappNumber: string | null;
  onWhatsapp: boolean;
  cityId: string | null;
  contactedOn: string;
  platformId: string;
  statusId: string;
  categoryId: string | null;
  subcategoryId: string | null;
  clothGenderId: string | null;
  fabricId: string | null;
  sizeId: string | null;
  urgencyId: string | null;
  quantity: number | null;
  request: string | null;
  notes: string | null;
  tags: string[];
}

export interface PlanResult {
  plan: ImportPlan;
  /** Only the rows whose verdict is `ready`, in file order. */
  ready: ResolvedRow[];
}

/**
 * Reads a CSV and works out what importing it would do.
 *
 * Note what is not here: no transaction, no insert, no update. Calling this twice with
 * the same text gives the same answer, which is what makes the confirmation step honest
 * - the commit re-reads the file through this function rather than trusting a report
 * that came back from a browser.
 */
export async function planImport(csv: string): Promise<PlanResult> {
  const table = parseCsv(csv, { maxRecords: MAX_IMPORT_ROWS });
  const columns = mapColumns(table.header);

  const emptyPlan = (): ImportPlan => ({
    columns: columns.columns.map((column) => ({
      heading: column.heading,
      field: column.field,
      derived: column.derived,
    })),
    unrecognised: columns.unrecognised,
    missingRequired: columns.missingRequired,
    summary: emptySummary(),
    rows: [],
    unplaced: [],
    truncated: table.truncated,
    delimiter: table.delimiter,
    csv,
  });

  // Without the columns that identify a customer and date an enquiry there is nothing
  // to report row by row, and a hundred identical "no phone column" messages would bury
  // the one thing that needs fixing.
  if (columns.missingRequired.length > 0 || table.records.length === 0) {
    return { plan: emptyPlan(), ready: [] };
  }

  const lookups = await importLookups();
  const today = todayInBusinessTime();

  const unplaced = new Map<string, UnplacedValue>();
  const rows: PlannedRow[] = [];
  const candidates: ResolvedRow[] = [];

  for (const record of table.records) {
    const outcome = readRow(record, columns, lookups, today, unplaced);

    if (outcome.kind === 'rejected') {
      rows.push({
        line: record.line,
        verdict: 'rejected',
        problems: outcome.problems,
        preview: outcome.preview,
      });

      continue;
    }

    candidates.push(outcome.row);
    rows.push({
      line: record.line,
      // Provisional. Deciding between ready, duplicate and present needs the whole
      // file and one query, so it happens below.
      verdict: 'ready',
      problems: outcome.problems,
      preview: outcome.preview,
    });
  }

  const known = await existingFacts(candidates);

  const seen = new Set<string>();
  const ready: ResolvedRow[] = [];
  const newPhones = new Set<string>();
  const returningPhones = new Set<string>();
  const byLine = new Map(rows.map((row) => [row.line, row]));

  for (const row of candidates) {
    const planned = byLine.get(row.line)!;

    let verdict: RowVerdict = 'ready';

    if (seen.has(row.fingerprint)) {
      verdict = 'duplicate';
      planned.problems = [
        ...planned.problems,
        { field: null, message: 'An earlier line in this file says the same thing.' },
      ];
    } else if (known.leads.has(row.fingerprint)) {
      verdict = 'present';
      planned.problems = [
        ...planned.problems,
        { field: null, message: 'This enquiry is already recorded.' },
      ];
    }

    seen.add(row.fingerprint);
    planned.verdict = verdict;

    const isNew = !known.phones.has(row.phone);
    planned.preview.newCustomer = isNew;

    if (verdict === 'ready') {
      ready.push(row);
      if (isNew) newPhones.add(row.phone);
      else returningPhones.add(row.phone);
    }
  }

  const days = ready.map((row) => row.contactedOn).sort();

  const summary: ImportSummary = {
    rows: rows.length,
    ready: ready.length,
    duplicate: rows.filter((row) => row.verdict === 'duplicate').length,
    present: rows.filter((row) => row.verdict === 'present').length,
    rejected: rows.filter((row) => row.verdict === 'rejected').length,
    newCustomers: newPhones.size,
    returningCustomers: returningPhones.size,
    earliestDay: days[0] ?? null,
    latestDay: days.at(-1) ?? null,
  };

  return {
    plan: {
      ...emptyPlan(),
      summary,
      rows,
      unplaced: [...unplaced.values()].sort((a, b) => b.rows - a.rows),
    },
    ready,
  };
}

function emptySummary(): ImportSummary {
  return {
    rows: 0,
    ready: 0,
    duplicate: 0,
    present: 0,
    rejected: 0,
    newCustomers: 0,
    returningCustomers: 0,
    earliestDay: null,
    latestDay: null,
  };
}

type RowOutcome =
  | { kind: 'resolved'; row: ResolvedRow; problems: RowProblem[]; preview: PlannedRow['preview'] }
  | { kind: 'rejected'; problems: RowProblem[]; preview: PlannedRow['preview'] };

/**
 * One spreadsheet row, resolved as far as it will go.
 *
 * Every problem in the row is collected rather than returning at the first one: someone
 * fixing a sheet wants the whole list of what is wrong with line 41, not four passes.
 */
function readRow(
  record: CsvRecord,
  columns: ColumnMap,
  lookups: ImportLookups,
  today: string,
  unplaced: Map<string, UnplacedValue>
): RowOutcome {
  const problems: RowProblem[] = [];
  const cell = (field: ImportField) => cellAt(record, columns.indexes[field]);

  const note = (field: ImportField, message: string) => problems.push({ field, message });

  /** Resolves a described field, recording an unmatched value for the report. */
  const place = (field: ImportField, lookup: Lookup) => {
    const raw = cell(field);
    if (raw === null) return null;

    const id = findIn(lookup, raw);

    if (id === null) {
      remember(unplaced, lookup.label, lookup.href, raw);
      note(field, `"${raw}" is not in ${lookup.label.toLowerCase()} yet.`);
      return null;
    }

    return id;
  };

  const phoneRaw = cell('phone');
  const dayRaw = cell('contactedOn');
  const platformId = place('platform', lookups.platform);

  if (phoneRaw === null) note('phone', 'No contact number, so there is nobody to attach this to.');
  if (dayRaw === null) note('contactedOn', 'No date, so this enquiry cannot be placed in time.');

  let day: string | null = null;
  if (dayRaw !== null) {
    const read = readDay(dayRaw);

    if (!read.ok) note('contactedOn', read.message);
    else if (isFutureDay(read.value, APP_TIMEZONE)) {
      note('contactedOn', `${read.value} is in the future. Today is ${today}.`);
    } else day = read.value;
  }

  /* The customer's WhatsApp column carries either an answer or a second number. */
  const whatsappRaw = cell('whatsapp');
  const whatsappFlag = whatsappRaw === null ? null : readFlag(whatsappRaw);
  const whatsappNumber = whatsappRaw !== null && whatsappFlag === null ? whatsappRaw : '';

  let quantity: number | null = null;
  const quantityRaw = cell('quantity');
  if (quantityRaw !== null) {
    const read = readQuantity(quantityRaw);
    if (!read.ok) note('quantity', read.message);
    else quantity = read.value;
  }

  const categoryRaw = cell('category');
  const subcategoryRaw = cell('subcategory');

  let subcategoryId: string | null = null;
  let categoryId: string | null = null;

  if (subcategoryRaw !== null) {
    const match = findSubcategory(lookups.subcategory, subcategoryRaw, categoryRaw);

    if (match.kind === 'found') {
      subcategoryId = match.id;
      // Taken from the sub-category, never from the sheet: the two must agree, and the
      // database has a composite key that refuses the pair if they do not.
      categoryId = match.categoryId;
    } else if (match.kind === 'ambiguous') {
      note(
        'subcategory',
        `"${subcategoryRaw}" exists under more than one category. Name the category in its own column too.`
      );
    } else {
      remember(unplaced, lookups.subcategory.label, lookups.subcategory.href, subcategoryRaw);
      note('subcategory', `"${subcategoryRaw}" is not in sub-categories yet.`);
    }
  } else if (categoryRaw !== null) {
    categoryId = place('category', lookups.category);
  }

  const tagIds: string[] = [];
  const tagsRaw = cell('tags');
  if (tagsRaw !== null) {
    for (const value of readList(tagsRaw)) {
      const id = findIn(lookups.tag, value);

      if (id === null) {
        remember(unplaced, lookups.tag.label, lookups.tag.href, value);
        note('tags', `"${value}" is not in tags yet.`);
      } else if (!tagIds.includes(id)) tagIds.push(id);
    }
  }

  const statusId = place('status', lookups.status) ?? lookups.defaultStatusId;
  if (statusId === null) note('status', 'There are no lead statuses to file this under.');

  const cityId = place('city', lookups.city);
  const clothGenderId = place('gender', lookups.gender);
  const fabricId = place('fabric', lookups.fabric);
  const sizeId = place('size', lookups.size);
  const urgencyId = place('urgency', lookups.urgency);

  const preview: PlannedRow['preview'] = {
    phone: phoneRaw,
    name: cell('customerName'),
    day,
    platform: cell('platform'),
    status: cell('status'),
    interest: subcategoryRaw ?? categoryRaw,
    quantity,
    tags: tagIds.length,
    newCustomer: false,
  };

  // The same schema the form posts through, so there is one definition of a valid lead.
  const parsed = createLeadSchema.safeParse({
    phone: phoneRaw ?? '',
    customerName: cell('customerName') ?? '',
    whatsappNumber,
    onWhatsapp: whatsappFlag ?? true,
    cityId: cityId ?? '',
    contactedOn: day ?? '',
    platformId: platformId ?? '',
    statusId: statusId ?? '',
    categoryId: categoryId ?? '',
    subcategoryId: subcategoryId ?? '',
    clothGenderId: clothGenderId ?? '',
    fabricId: fabricId ?? '',
    sizeId: sizeId ?? '',
    urgencyId: urgencyId ?? '',
    quantity: quantity ?? '',
    request: cell('request') ?? '',
    notes: cell('notes') ?? '',
    tags: tagIds,
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = fieldOfPath(String(issue.path[0] ?? ''));

      // A missing id here is the consequence of a problem already reported in plainer
      // words above - "not in platforms yet" rather than "that is not a valid choice".
      if (field !== null && problems.some((problem) => problem.field === field)) continue;

      problems.push({ field, message: issue.message });
    }
  }

  if (!parsed.success || problems.length > 0 || day === null || statusId === null) {
    return { kind: 'rejected', problems, preview };
  }

  const input = parsed.data;

  const row: ResolvedRow = {
    line: record.line,
    fingerprint: fingerprintOf({
      phone: input.phone,
      day,
      subcategoryId,
      quantity: input.quantity,
      request: input.request,
    }),
    phone: input.phone,
    customerName: input.customerName,
    whatsappNumber: input.whatsappNumber,
    onWhatsapp: input.onWhatsapp,
    cityId: input.cityId,
    contactedOn: day,
    platformId: input.platformId,
    statusId: input.statusId,
    categoryId,
    subcategoryId,
    clothGenderId: input.clothGenderId,
    fabricId: input.fabricId,
    sizeId: input.sizeId,
    urgencyId: input.urgencyId,
    quantity: input.quantity,
    request: input.request,
    notes: input.notes,
    tags: input.tags,
  };

  return { kind: 'resolved', row, problems, preview };
}

/** Maps a schema field back to the spreadsheet column it came from. */
function fieldOfPath(path: string): ImportField | null {
  const map: Record<string, ImportField> = {
    phone: 'phone',
    customerName: 'customerName',
    whatsappNumber: 'whatsapp',
    onWhatsapp: 'whatsapp',
    cityId: 'city',
    contactedOn: 'contactedOn',
    platformId: 'platform',
    statusId: 'status',
    categoryId: 'category',
    subcategoryId: 'subcategory',
    clothGenderId: 'gender',
    fabricId: 'fabric',
    sizeId: 'size',
    urgencyId: 'urgency',
    quantity: 'quantity',
    request: 'request',
    notes: 'notes',
    tags: 'tags',
  };

  return map[path] ?? null;
}

function remember(
  unplaced: Map<string, UnplacedValue>,
  taxonomy: string,
  href: string,
  value: string
): void {
  const key = `${taxonomy}\u0000${value.toLowerCase()}`;
  const existing = unplaced.get(key);

  if (existing) existing.rows += 1;
  else unplaced.set(key, { taxonomy, href, value, rows: 1 });
}

/**
 * What makes two enquiries the same enquiry.
 *
 * Customer and day, plus what they asked for. Deliberately not the status or the notes:
 * a row re-exported after someone moved it from New Inquiry to Contacted is the same
 * enquiry, and importing it again would double the demand it represents.
 */
export function fingerprintOf(input: {
  phone: string;
  day: string;
  subcategoryId: string | null;
  quantity: number | null;
  request: string | null;
}): string {
  return [
    input.phone,
    input.day,
    input.subcategoryId ?? '',
    input.quantity ?? '',
    fingerprintText(input.request),
  ].join('\u0000');
}

/**
 * The customers and enquiries we already have, for the rows this file is about.
 *
 * Two queries rather than one join, because they answer different questions: a customer
 * on file with no enquiry yet is still a returning customer, and a join from `leads`
 * would call them new.
 */
async function existingFacts(
  candidates: readonly ResolvedRow[]
): Promise<{ phones: Set<string>; leads: Set<string> }> {
  const phones = [...new Set(candidates.map((row) => row.phone))];

  if (phones.length === 0) return { phones: new Set(), leads: new Set() };

  const onFile = await db
    .select({ phone: customers.phone })
    .from(customers)
    .where(inArray(customers.phone, phones));

  const rows = await db
    .select({
      phone: customers.phone,
      // Grouped by the calendar day in business time, the same way the fingerprint is
      // built, so a lead recorded at 23:30 Doha time is not a different day here.
      day: sql<string>`to_char(${leads.contactedAt} at time zone ${APP_TIMEZONE}, 'YYYY-MM-DD')`,
      subcategoryId: leads.subcategoryId,
      quantity: leads.quantity,
      request: leads.request,
    })
    .from(leads)
    .innerJoin(customers, sql`${customers.id} = ${leads.customerId}`)
    .where(and(inArray(customers.phone, phones), isNull(leads.deletedAt)));

  return {
    phones: new Set(onFile.map((row) => row.phone)),
    leads: new Set(
      rows.map((row) =>
        fingerprintOf({
          phone: row.phone,
          day: row.day,
          subcategoryId: row.subcategoryId,
          quantity: row.quantity,
          request: row.request,
        })
      )
    ),
  };
}
