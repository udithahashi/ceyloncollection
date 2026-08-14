/**
 * Which spreadsheet column is which field.
 *
 * The headings come from a sheet that was written for a person to read, so they are
 * matched loosely: case, spaces, punctuation and bracketed asides are stripped before
 * comparing. "Contact Number", "contact_number" and "Phone No." are the same column.
 *
 * Four of the sheet's columns are deliberately ignored rather than unrecognised. Days
 * Since Contact, Requests by Customer, Customer Type and Sub-Cat Demand are all
 * *derived* - the system computes them from the leads themselves, and importing a
 * snapshot of them would be importing numbers that are already stale. Saying so in the
 * report is better than a silent drop or a warning about a column the person was right
 * to include.
 *
 * Pure: no environment, no database. The client imports it to render the mapping.
 */

/**
 * The fields, in the order the business's own sheet has them.
 *
 * The order is only used for the downloadable template, but it matters there: a template
 * whose columns sit where the existing spreadsheet's columns sit can be filled in by
 * copying whole columns across.
 */
export const importFields = [
  'contactedOn',
  'customerName',
  'phone',
  'whatsapp',
  'city',
  'platform',
  'category',
  'subcategory',
  'gender',
  'fabric',
  'size',
  'quantity',
  'urgency',
  'status',
  'tags',
  'request',
  'notes',
] as const;

export type ImportField = (typeof importFields)[number];

export interface ImportColumn {
  /** The heading written into the downloadable template. */
  label: string;
  required: boolean;
  /** What the importer does with it, shown in the mapping table. */
  hint: string;
  /** Extra headings accepted for this column, already normalised. */
  aliases: readonly string[];
}

export const importColumns: Record<ImportField, ImportColumn> = {
  phone: {
    label: 'Contact Number',
    required: true,
    hint: 'Identifies the customer. Any Qatari or Sri Lankan format.',
    aliases: ['phone', 'phonenumber', 'contact', 'contactno', 'mobile', 'mobileno', 'number'],
  },
  customerName: {
    label: 'Customer Name',
    required: false,
    hint: 'Kept if we do not already have a name for this number.',
    aliases: ['name', 'customer', 'client', 'clientname'],
  },
  whatsapp: {
    label: 'WhatsApp',
    required: false,
    hint: 'Yes or no, or a second number if it differs from the contact number.',
    aliases: ['whatsappnumber', 'whatsappno', 'onwhatsapp', 'wa'],
  },
  city: {
    label: 'City/Area (Qatar)',
    required: false,
    hint: 'Matched against Cities.',
    aliases: ['city', 'area', 'cityarea', 'location', 'town'],
  },
  contactedOn: {
    label: 'Date',
    required: true,
    hint: 'When they got in touch. Slash dates are read day first.',
    aliases: ['contactdate', 'contacted', 'contactedon', 'datecontacted', 'enquirydate', 'day'],
  },
  platform: {
    label: 'Platform',
    required: true,
    hint: 'Matched against Platforms.',
    aliases: ['source', 'channel', 'camefrom', 'via'],
  },
  status: {
    label: 'Status',
    required: false,
    hint: 'Matched against Lead statuses. Blank becomes the default status.',
    aliases: ['leadstatus', 'stage'],
  },
  category: {
    label: 'Category',
    required: false,
    hint: 'Matched against Categories. Derived from the sub-category when that is given.',
    aliases: ['parentcategory', 'productcategory'],
  },
  subcategory: {
    label: 'Sub-Category',
    required: false,
    hint: 'Matched against Sub-categories. Name the category too if it is ambiguous.',
    aliases: ['subcat', 'productsubcategory', 'item', 'product'],
  },
  gender: {
    label: 'Gender(cloth gender)',
    required: false,
    hint: 'Who the garment is for. Matched against Cloth genders.',
    aliases: ['gender', 'clothgender', 'wearer', 'for'],
  },
  fabric: {
    label: 'Fabric/Material',
    required: false,
    hint: 'Matched against Fabrics.',
    aliases: ['fabric', 'material', 'cloth'],
  },
  size: {
    label: 'Size',
    required: false,
    hint: 'Matched against Sizes.',
    aliases: ['sizes', 'sizerequested'],
  },
  quantity: {
    label: 'Qty Requested',
    required: false,
    hint: 'A whole number of pieces. Blank means they did not say.',
    aliases: ['qty', 'quantity', 'pieces', 'pcs', 'quantityrequested'],
  },
  urgency: {
    label: 'Urgency/Intent',
    required: false,
    hint: 'Matched against Urgency levels. This is what makes a lead hot.',
    aliases: ['urgency', 'intent', 'interest', 'interestlevel'],
  },
  request: {
    label: 'Request',
    required: false,
    hint: 'What they asked for, in their words.',
    aliases: ['requested', 'requestdetails', 'enquiry', 'whattheywant', 'description'],
  },
  tags: {
    label: 'Tags',
    required: false,
    hint: 'Separated by commas, semicolons or pipes. Matched against Tags.',
    aliases: ['tag', 'labels', 'attributes'],
  },
  notes: {
    label: 'Notes',
    required: false,
    hint: 'Anything else. Kept verbatim.',
    aliases: ['note', 'comment', 'comments', 'remarks', 'internalnotes'],
  },
};

/** Columns the sheet may carry that the system computes for itself. */
export const derivedColumns: readonly { label: string; aliases: readonly string[]; why: string }[] =
  [
    {
      label: 'ID',
      aliases: ['id', 'no', 'sno', 'serial', 'rowid', 'leadid', 'reference', 'ref'],
      why: 'Each lead gets its own reference number here.',
    },
    {
      label: 'Requests by Customer',
      aliases: ['requestsbycustomer', 'totalrequests', 'requests', 'requestcount'],
      why: 'Counted from the leads themselves.',
    },
    {
      label: 'Customer Type',
      aliases: ['customertype', 'repeatnew', 'newrepeat', 'type'],
      why: 'Repeat or new follows from the phone number.',
    },
    {
      label: 'Sub-Cat Demand',
      aliases: ['subcatdemand', 'subcategorydemand', 'demand'],
      why: 'Read from the demand board instead.',
    },
    {
      label: 'Days Since Contact',
      aliases: ['dayssincecontact', 'dayssince', 'age', 'daysold'],
      why: 'Counted from the contact date, so it is never stale.',
    },
  ];

/**
 * Reduces a heading to letters and digits.
 *
 * `Gender(cloth gender)` and `Sub-Category` become `genderclothgender` and
 * `subcategory`, which is what makes matching indifferent to how the sheet was typed.
 */
export function normaliseHeading(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');
}

/** Every accepted heading for a field, including its own label. */
function headingsFor(field: ImportField): string[] {
  const column = importColumns[field];
  return [normaliseHeading(column.label), ...column.aliases];
}

export interface MappedColumn {
  heading: string;
  /** The column's position in the file, for reading cells out of a record. */
  index: number;
  field: ImportField | null;
  /** Set when the column is one the system computes for itself. */
  derived: string | null;
}

export interface ColumnMap {
  columns: MappedColumn[];
  /** Field to column index. Absent fields are simply missing. */
  indexes: Partial<Record<ImportField, number>>;
  missingRequired: ImportField[];
  /** Headings that matched nothing, which are ignored but worth naming. */
  unrecognised: string[];
}

/**
 * Works out which column holds which field.
 *
 * A repeated heading keeps the first occurrence: two columns called Notes is a sheet
 * problem, and reading the leftmost is the least surprising resolution.
 */
export function mapColumns(header: readonly string[]): ColumnMap {
  const columns: MappedColumn[] = [];
  const indexes: Partial<Record<ImportField, number>> = {};
  const unrecognised: string[] = [];

  header.forEach((heading, index) => {
    const key = normaliseHeading(heading);

    if (key === '') {
      // An unnamed trailing column, which spreadsheets add freely.
      columns.push({ heading, index, field: null, derived: null });
      return;
    }

    const field = importFields.find((candidate) => headingsFor(candidate).includes(key)) ?? null;

    if (field !== null) {
      if (indexes[field] === undefined) indexes[field] = index;
      columns.push({ heading, index, field, derived: null });
      return;
    }

    const derived = derivedColumns.find((candidate) => candidate.aliases.includes(key));

    if (derived) {
      columns.push({ heading, index, field: null, derived: derived.why });
      return;
    }

    unrecognised.push(heading);
    columns.push({ heading, index, field: null, derived: null });
  });

  const missingRequired = importFields.filter(
    (field) => importColumns[field].required && indexes[field] === undefined
  );

  return { columns, indexes, missingRequired, unrecognised };
}

/** The heading row of the downloadable template, in a sensible order to fill in. */
export const templateHeader: readonly string[] = importFields.map(
  (field) => importColumns[field].label
);
