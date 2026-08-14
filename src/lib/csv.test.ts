import { describe, expect, it } from 'vitest';

import { cellAt, parseCsv, sniffDelimiter, stripBom } from './csv';

describe('parseCsv', () => {
  it('reads a header and its records', () => {
    const table = parseCsv('Name,Phone\nAmara,3312\nNimal,3313\n');

    expect(table.header).toEqual(['Name', 'Phone']);
    expect(table.records).toEqual([
      { line: 2, cells: ['Amara', '3312'] },
      { line: 3, cells: ['Nimal', '3313'] },
    ]);
  });

  it('keeps a comma inside a quoted cell', () => {
    const table = parseCsv('Name,City\n"Perera, A.",Doha\n');

    expect(table.records[0]?.cells).toEqual(['Perera, A.', 'Doha']);
  });

  it('reads a doubled quote as one quote', () => {
    const table = parseCsv('Note\n"She said ""urgent"""\n');

    expect(table.records[0]?.cells).toEqual(['She said "urgent"']);
  });

  it('keeps a newline inside a quoted cell and still counts lines correctly', () => {
    const table = parseCsv('Note,Phone\n"first\nsecond",3312\nNext,3313\n');

    expect(table.records[0]?.cells).toEqual(['first\nsecond', '3312']);
    // The following record starts on line 4: the quoted newline used one up.
    expect(table.records[1]).toEqual({ line: 4, cells: ['Next', '3313'] });
  });

  it('handles Windows line endings', () => {
    const table = parseCsv('Name,Phone\r\nAmara,3312\r\n');

    expect(table.records).toEqual([{ line: 2, cells: ['Amara', '3312'] }]);
  });

  it('drops the byte-order mark Excel writes', () => {
    const table = parseCsv('\uFEFFName,Phone\nAmara,3312\n');

    expect(table.header).toEqual(['Name', 'Phone']);
  });

  it('ignores blank lines, including a missing final newline', () => {
    const table = parseCsv('Name\n\nAmara\n\n\nNimal');

    expect(table.records.map((record) => record.cells[0])).toEqual(['Amara', 'Nimal']);
  });

  it('drops a row whose every cell is empty', () => {
    // `,,,,` is what Excel writes for a row that once had content, and it carries no
    // information at all. Reporting it as a row with missing values would fill the
    // import report with complaints about rows nobody wrote.
    const table = parseCsv('A,B,C\n1,2,3\n,,\n');

    expect(table.records).toHaveLength(1);
  });

  it('keeps a row that has any content at all', () => {
    const table = parseCsv('A,B,C\n,2,\n');

    expect(table.records[0]?.cells).toEqual(['', '2', '']);
  });

  it('trims the header but not the cells', () => {
    // A leading space in a name is a data problem to report, not one to hide. Header
    // whitespace is just how the file was written.
    const table = parseCsv(' Name , Phone \n Amara ,3312\n');

    expect(table.header).toEqual(['Name', 'Phone']);
    expect(table.records[0]?.cells[0]).toBe(' Amara ');
  });

  it('reads a semicolon-separated export', () => {
    const table = parseCsv('Name;Phone\nAmara;3312\n');

    expect(table.delimiter).toBe(';');
    expect(table.records[0]?.cells).toEqual(['Amara', '3312']);
  });

  it('reads a tab-separated export', () => {
    const table = parseCsv('Name\tPhone\nAmara\t3312\n');

    expect(table.delimiter).toBe('\t');
    expect(table.records[0]?.cells).toEqual(['Amara', '3312']);
  });

  it('stops at the record limit and says it did', () => {
    const table = parseCsv('N\n1\n2\n3\n4\n', { maxRecords: 2 });

    expect(table.records).toHaveLength(2);
    expect(table.truncated).toBe(true);
  });

  it('does not claim truncation when the file ends exactly on the limit', () => {
    const table = parseCsv('N\n1\n2\n', { maxRecords: 2 });

    expect(table.records).toHaveLength(2);
    expect(table.truncated).toBe(false);
  });

  it('returns an empty table for empty input', () => {
    const table = parseCsv('');

    expect(table.header).toEqual([]);
    expect(table.records).toEqual([]);
  });

  it('accepts a short row rather than padding it', () => {
    // The importer decides what a missing column means; the parser must not invent
    // a value for it.
    const table = parseCsv('A,B,C\n1,2\n');

    expect(table.records[0]?.cells).toEqual(['1', '2']);
  });
});

describe('sniffDelimiter', () => {
  it('ignores separators inside quotes', () => {
    expect(sniffDelimiter('"Doha, Qatar";Phone;Status')).toBe(';');
  });

  it('falls back to a comma when there is nothing to go on', () => {
    expect(sniffDelimiter('OneColumn')).toBe(',');
  });
});

describe('stripBom', () => {
  it('leaves text without a mark alone', () => {
    expect(stripBom('Name')).toBe('Name');
  });
});

describe('cellAt', () => {
  const record = { line: 2, cells: [' Amara ', '', '3312'] };

  it('trims a value', () => {
    expect(cellAt(record, 0)).toBe('Amara');
  });

  it('reads a blank cell, a missing cell and an unmapped column all as nothing', () => {
    expect(cellAt(record, 1)).toBeNull();
    expect(cellAt(record, 9)).toBeNull();
    expect(cellAt(record, undefined)).toBeNull();
  });
});
