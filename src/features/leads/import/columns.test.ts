import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseCsv } from '@/lib/csv';

import {
  importColumns,
  importFields,
  mapColumns,
  normaliseHeading,
  templateHeader,
} from './columns';

describe('normaliseHeading', () => {
  it('reduces a heading to letters and digits', () => {
    expect(normaliseHeading('Gender(cloth gender)')).toBe('genderclothgender');
    expect(normaliseHeading('  Sub-Category ')).toBe('subcategory');
    expect(normaliseHeading('Qty Requested')).toBe('qtyrequested');
  });
});

describe('mapColumns', () => {
  it('maps the business spreadsheet as it stands', () => {
    const { indexes, missingRequired, unrecognised } = mapColumns([
      'ID',
      'Date',
      'Customer Name',
      'Contact Number',
      'WhatsApp',
      'City/Area (Qatar)',
      'Platform',
      'Category',
      'Sub-Category',
      'Gender(cloth gender)',
      'Fabric/Material',
      'Size',
      'Qty Requested',
      'Urgency/Intent',
      'Status',
      'Tags',
      'Requests by Customer',
      'Customer Type',
      'Sub-Cat Demand',
      'Days Since Contact',
      'Notes',
    ]);

    expect(missingRequired).toEqual([]);
    expect(unrecognised).toEqual([]);
    expect(indexes.contactedOn).toBe(1);
    expect(indexes.phone).toBe(3);
    expect(indexes.quantity).toBe(12);
    expect(indexes.notes).toBe(20);
  });

  it('explains the derived columns rather than calling them unrecognised', () => {
    const { columns } = mapColumns(['Days Since Contact']);

    expect(columns[0]?.field).toBeNull();
    expect(columns[0]?.derived).toMatch(/contact date/);
  });

  it('accepts headings written any other way', () => {
    const { indexes, missingRequired } = mapColumns([
      'phone_number',
      'contact date',
      'CHANNEL',
      'fabric',
    ]);

    expect(missingRequired).toEqual([]);
    expect(indexes.phone).toBe(0);
    expect(indexes.contactedOn).toBe(1);
    expect(indexes.platform).toBe(2);
    expect(indexes.fabric).toBe(3);
  });

  it('names what is missing when the identifying columns are absent', () => {
    const { missingRequired } = mapColumns(['Customer Name', 'Notes']);

    expect(missingRequired).toEqual(['contactedOn', 'phone', 'platform']);
  });

  it('reports a heading it cannot place', () => {
    const { unrecognised } = mapColumns(['Contact Number', 'Date', 'Platform', 'Shipping Agent']);

    expect(unrecognised).toEqual(['Shipping Agent']);
  });

  it('keeps the leftmost of two columns with the same heading', () => {
    const { indexes } = mapColumns(['Notes', 'Notes']);

    expect(indexes.notes).toBe(0);
  });

  it('tolerates an unnamed trailing column', () => {
    const { columns, unrecognised } = mapColumns(['Contact Number', '']);

    expect(unrecognised).toEqual([]);
    expect(columns[1]?.field).toBeNull();
  });
});

describe('the field definitions', () => {
  it('gives every field a label and a hint', () => {
    for (const field of importFields) {
      expect(importColumns[field].label, field).not.toBe('');
      expect(importColumns[field].hint, field).not.toBe('');
    }
  });

  it('requires only the two columns that identify an enquiry', () => {
    const required = importFields.filter((field) => importColumns[field].required);

    expect(required).toEqual(['contactedOn', 'phone', 'platform']);
  });

  it('has no heading claimed by two fields', () => {
    const seen = new Map<string, string>();

    for (const field of importFields) {
      for (const heading of [
        normaliseHeading(importColumns[field].label),
        ...importColumns[field].aliases,
      ]) {
        expect(
          seen.get(heading),
          `${heading} is claimed by ${seen.get(heading)} and ${field}`
        ).toBeUndefined();
        seen.set(heading, field);
      }
    }
  });
});

describe('the downloadable template', () => {
  const file = readFileSync(path.join(process.cwd(), 'public', 'lead-import-template.csv'), 'utf8');

  const table = parseCsv(file);

  it('has the headings the importer expects', () => {
    // The file is static, so nothing else stops it drifting from the definitions above.
    expect(table.header).toEqual([...templateHeader]);
  });

  it('maps onto every field, with nothing left over', () => {
    const { missingRequired, unrecognised, indexes } = mapColumns(table.header);

    expect(missingRequired).toEqual([]);
    expect(unrecognised).toEqual([]);
    expect(Object.keys(indexes)).toHaveLength(importFields.length);
  });

  it('shows an example of every column being used', () => {
    // A template whose example row leaves half the columns blank teaches nothing about
    // what belongs in them.
    expect(table.records[0]?.cells.filter((cell) => cell.trim() !== '')).toHaveLength(
      importFields.length
    );
  });
});
