/**
 * GSheetTool - shared cleaning logic (used by the /api/clean serverless function).
 *
 *  - combineName : "First" + "Last"  -> "First Last"
 *  - normalisePhone : NZ numbers -> plain local form "0XXXXXXXXX"
 *  - parseCsv / toCsv : minimal RFC-4180-ish CSV
 *  - transform : run the whole clean over a parsed grid
 *
 * Kept in sync with ../../python/phone_rules.py and ../../apps-script/Code.gs.
 */

const COUNTRY_CODE = '64';

/* --------------------------------------------------------------------- */
/* Phone                                                                  */
/* --------------------------------------------------------------------- */

export function toNational(raw) {
  const text = String(raw == null ? '' : raw).trim().replace(/^'+/, '').trim();
  if (!text) return null;

  let digits = text.replace(/\D+/g, '');
  if (!digits) return null;

  const international = text.charAt(0) === '+' || digits.indexOf('00') === 0;

  if (international) {
    digits = digits.replace(/^0+/, '');
    if (digits.indexOf(COUNTRY_CODE) === 0) digits = digits.slice(COUNTRY_CODE.length);
    if (digits.charAt(0) === '0') digits = digits.slice(1);
  } else if (digits.indexOf(COUNTRY_CODE) === 0 && digits.length >= 10) {
    digits = digits.slice(COUNTRY_CODE.length);
    if (digits.charAt(0) === '0') digits = digits.slice(1);
  } else if (digits.charAt(0) === '0') {
    digits = digits.slice(1);
  }

  if (digits.length < 4) return null;
  return digits;
}

/**
 * Plain local NZ form: a single leading "0" then the national digits, no
 * spaces or punctuation (e.g. "02904343199"). Drops a leading apostrophe,
 * any "+64" / "0064" / "64" country code and extra trunk zeros. Returns null
 * if there is no usable number.
 */
export function normalisePhone(raw) {
  const national = toNational(raw);
  if (national == null) return null;
  return '0' + national;
}

export function tryNormalisePhone(raw) {
  const original = raw == null ? '' : String(raw);
  if (!original.trim()) return { value: original, status: 'empty' };
  const fixed = normalisePhone(original);
  if (fixed == null) return { value: original, status: 'failed' };
  return { value: fixed, status: fixed !== original.trim() ? 'fixed' : 'unchanged' };
}

/* --------------------------------------------------------------------- */
/* Name                                                                   */
/* --------------------------------------------------------------------- */

export function combineName(first, last) {
  const parts = [
    String(first == null ? '' : first).trim(),
    String(last == null ? '' : last).trim(),
  ].filter((s) => s.length > 0);
  return parts.join(' ');
}

/* --------------------------------------------------------------------- */
/* CSV                                                                    */
/* --------------------------------------------------------------------- */

export function parseCsv(text) {
  if (text && text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += c; i += 1; continue;
    }
    if (c === '"') { inQuotes = true; i += 1; continue; }
    if (c === ',') { row.push(field); field = ''; i += 1; continue; }
    if (c === '\r') { i += 1; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue; }
    field += c; i += 1;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

export function toCsv(rows) {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = cell == null ? '' : String(cell);
          return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        })
        .join(','),
    )
    .join('\r\n');
}

/* --------------------------------------------------------------------- */
/* Column resolution                                                      */
/* --------------------------------------------------------------------- */

const FIRST_PATTERNS = [/^first[\s_]*name$/i, /^f[\s_]*name$/i, /^given[\s_]*name$/i, /first\s*name/i, /^first$/i, /^fname$/i];
const LAST_PATTERNS = [/^last[\s_]*name$/i, /^l[\s_]*name$/i, /^surname$/i, /^family[\s_]*name$/i, /last\s*name/i, /^last$/i, /^lname$/i];
const PHONE_PATTERNS = [/phone/i, /mobile/i, /\bcell\b/i, /contact.*(number|no\b)/i, /^number$/i, /telephone/i, /\btel\b/i, /msisdn/i];
const NAME_TARGET_PATTERNS = [/^full[\s_]*name$/i, /^name$/i, /^full$/i, /^customer[\s_]*name$/i, /^contact[\s_]*name$/i, /^display[\s_]*name$/i];

function columnLetterToIndex(letters) {
  let idx = 0;
  const up = letters.toUpperCase();
  for (let i = 0; i < up.length; i += 1) idx = idx * 26 + (up.charCodeAt(i) - 64);
  return idx - 1;
}

export function resolveColumn(headers, spec) {
  if (spec == null) return -1;
  const s = String(spec).trim();
  if (!s) return -1;
  if (/^[0-9]+$/.test(s)) return parseInt(s, 10) - 1;
  if (/^[A-Za-z]{1,3}$/.test(s)) return columnLetterToIndex(s);
  const low = headers.map((h) => h.trim().toLowerCase());
  const want = s.toLowerCase();
  const exact = low.indexOf(want);
  if (exact !== -1) return exact;
  for (let i = 0; i < low.length; i += 1) if (low[i].includes(want)) return i;
  return -1;
}

function detectColumn(headers, patterns) {
  for (const pattern of patterns) {
    for (let i = 0; i < headers.length; i += 1) {
      if (pattern.test(headers[i].trim())) return i;
    }
  }
  return -1;
}

/* --------------------------------------------------------------------- */
/* Transform                                                              */
/* --------------------------------------------------------------------- */

export function transform(grid, options = {}) {
  const nonEmpty = grid.filter((r) => r.some((c) => String(c == null ? '' : c).trim() !== ''));
  if (nonEmpty.length === 0) throw new Error('The sheet / CSV has no data.');
  if (nonEmpty.length === 1) throw new Error('Found a header row but no data rows.');

  const headers = nonEmpty[0].map((h) => String(h).trim());

  const firstIdx = options.firstCol ? resolveColumn(headers, options.firstCol) : detectColumn(headers, FIRST_PATTERNS);
  const lastIdx = options.lastCol ? resolveColumn(headers, options.lastCol) : detectColumn(headers, LAST_PATTERNS);
  const phoneIdx = options.phoneCol ? resolveColumn(headers, options.phoneCol) : detectColumn(headers, PHONE_PATTERNS);

  let nameIdx;
  let nameCreated = false;
  if (options.nameCol) {
    nameIdx = resolveColumn(headers, options.nameCol);
    if (nameIdx === -1 || nameIdx >= headers.length) {
      nameIdx = headers.length;
      headers.push(String(options.nameCol));
      nameCreated = true;
    }
  } else {
    nameIdx = detectColumn(headers, NAME_TARGET_PATTERNS);
    if (nameIdx === -1) {
      nameIdx = headers.length;
      headers.push('Full Name');
      nameCreated = true;
    }
  }
  const width = headers.length;

  const report = {
    source: options.source || 'upload',
    totalRows: 0,
    firstNameColumn: firstIdx === -1 ? null : headers[firstIdx],
    lastNameColumn: lastIdx === -1 ? null : headers[lastIdx],
    phoneColumn: phoneIdx === -1 ? null : headers[phoneIdx],
    fullNameColumn: headers[nameIdx],
    fullNameColumnCreated: nameCreated,
    namesCombined: 0,
    phonesFixed: 0,
    phonesUnchanged: 0,
    phonesFailed: [],
    warnings: [],
  };
  if (firstIdx === -1 || lastIdx === -1) {
    report.warnings.push('Could not identify both name columns - names were not combined. Set them under Advanced options.');
  }
  if (phoneIdx === -1) {
    report.warnings.push('Could not identify a phone column - set it under Advanced options.');
  }

  const outRows = [headers.slice()];
  const changed = []; // parallel to outRows[1..]: { name: bool, phone: bool }

  for (let r = 1; r < nonEmpty.length; r += 1) {
    const row = nonEmpty[r].slice();
    while (row.length < width) row.push('');
    report.totalRows += 1;
    const flag = { name: false, phone: false };

    if (firstIdx !== -1 && lastIdx !== -1) {
      const full = combineName(row[firstIdx], row[lastIdx]);
      if (full) {
        if (String(row[nameIdx] == null ? '' : row[nameIdx]).trim() !== full) {
          report.namesCombined += 1;
          flag.name = true;
        }
        row[nameIdx] = full;
      }
    }

    if (phoneIdx !== -1) {
      const current = String(row[phoneIdx] == null ? '' : row[phoneIdx]).trim();
      if (current) {
        const res = tryNormalisePhone(row[phoneIdx]);
        if (res.status === 'fixed') {
          row[phoneIdx] = res.value;
          report.phonesFixed += 1;
          flag.phone = true;
        } else if (res.status === 'unchanged') {
          report.phonesUnchanged += 1;
        } else if (res.status === 'failed') {
          report.phonesFailed.push({ row: r + 1, value: current });
        }
      }
    }

    outRows.push(row);
    changed.push(flag);
  }

  return {
    headers,
    rows: outRows,
    changed,
    columns: { firstIdx, lastIdx, phoneIdx, nameIdx },
    report,
  };
}
