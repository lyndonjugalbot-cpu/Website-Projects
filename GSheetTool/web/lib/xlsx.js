/**
 * GSheetTool - minimal .xlsx reader (server-side / Node only).
 *
 * An .xlsx file is a ZIP archive of XML parts. This reads one worksheet out of
 * it as a plain string grid, with no external dependencies - just node:zlib for
 * the DEFLATE entries. It is deliberately small: enough to pull a contact list
 * (text, numbers, booleans, dates) out of a sheet, not a full OOXML engine.
 *
 * Kept in sync with ../../python/xlsx_reader.py.
 */

import zlib from 'node:zlib';

/* --------------------------------------------------------------------- */
/* ZIP                                                                    */
/* --------------------------------------------------------------------- */

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | b[o + 3] * 0x1000000) >>> 0;

function unzip(buf) {
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  const start = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= start; i -= 1) {
    if (u32(buf, i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('That file is not a valid .xlsx (no ZIP end-of-directory record).');

  const count = u16(buf, eocd + 10);
  let p = u32(buf, eocd + 16);
  const files = Object.create(null);

  for (let n = 0; n < count; n += 1) {
    if (u32(buf, p) !== 0x02014b50) break; // central-directory header
    const method = u16(buf, p + 10);
    const compSize = u32(buf, p + 20);
    const nameLen = u16(buf, p + 28);
    const extraLen = u16(buf, p + 30);
    const commentLen = u16(buf, p + 32);
    const localOff = u32(buf, p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    const lhNameLen = u16(buf, localOff + 26);
    const lhExtraLen = u16(buf, localOff + 28);
    const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);

    let content;
    if (method === 0) content = Buffer.from(raw);
    else if (method === 8) content = zlib.inflateRawSync(raw);
    else throw new Error(`Unsupported compression in .xlsx (ZIP method ${method}).`);

    files[name] = content;
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/* --------------------------------------------------------------------- */
/* XML helpers (regex-based - OOXML parts are machine-written)            */
/* --------------------------------------------------------------------- */

function decodeXml(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (whole, ent) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X'
        ? parseInt(ent.slice(2), 16)
        : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[ent] ?? whole;
  });
}

// tag name, optional namespace prefix, e.g. <si> or <x:si>
const tag = (n) => `(?:\\w+:)?${n}`;

function textOfRun(fragment) {
  let out = '';
  const re = new RegExp(`<${tag('t')}[^>]*?(/>|>([\\s\\S]*?)</${tag('t')}>)`, 'g');
  let m;
  while ((m = re.exec(fragment))) out += m[1] === '/>' ? '' : decodeXml(m[2]);
  return out;
}

/* --------------------------------------------------------------------- */
/* Workbook parts                                                         */
/* --------------------------------------------------------------------- */

function parseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  const re = new RegExp(`<${tag('si')}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag('si')}>`, 'g');
  let m;
  while ((m = re.exec(xml))) out.push(textOfRun(m[1]));
  return out;
}

// builtin number-format ids that mean "date" / "time"
const BUILTIN_DATE_FMT = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function parseStyleDateFlags(xml) {
  if (!xml) return [];
  const customDate = new Map();
  const fmtRe = /<numFmt\b[^>]*\bnumFmtId="(\d+)"[^>]*\bformatCode="([^"]*)"[^>]*\/>/g;
  let fm;
  while ((fm = fmtRe.exec(xml))) {
    const code = decodeXml(fm[2]).replace(/\[[^\]]*]/g, '').replace(/"[^"]*"/g, '');
    customDate.set(Number(fm[1]), /[dy]/i.test(code) || /m/.test(code));
  }

  const flags = [];
  const xfsBlock = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
  if (!xfsBlock) return flags;
  const xfRe = /<xf\b[^>]*?\/?>/g;
  let xf;
  while ((xf = xfRe.exec(xfsBlock[1]))) {
    const id = /\bnumFmtId="(\d+)"/.exec(xf[0]);
    const n = id ? Number(id[1]) : 0;
    flags.push(BUILTIN_DATE_FMT.has(n) || customDate.get(n) === true);
  }
  return flags;
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30); // 1900 date system, incl. the leap-year bug

function serialToISO(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n)) return String(serial);
  const ms = EXCEL_EPOCH + Math.round(n * 86400000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(serial);
  const iso = d.toISOString();
  return n % 1 === 0 ? iso.slice(0, 10) : iso.slice(0, 19).replace('T', ' ');
}

function colToIndex(ref) {
  const letters = /^[A-Z]+/.exec(ref);
  if (!letters) return 0;
  let idx = 0;
  for (const ch of letters[0]) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}

function parseSheet(xml, shared, dateFlags) {
  const rows = [];
  const rowRe = new RegExp(`<${tag('row')}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag('row')}>|<${tag('row')}(?:\\s[^>]*)?/>`, 'g');
  const cellRe = new RegExp(`<${tag('c')}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag('c')}>)`, 'g');
  let rm;
  let expectedRow = 0;

  while ((rm = rowRe.exec(xml))) {
    const rowAttrs = /^<[^>]*\br="(\d+)"/.exec(rm[0]);
    const rowNum = rowAttrs ? Number(rowAttrs[1]) : expectedRow + 1;
    while (expectedRow < rowNum - 1) { rows.push([]); expectedRow += 1; }
    expectedRow = rowNum;

    const cells = [];
    const body = rm[1] || '';
    let cm;
    let expectedCol = 0;
    while ((cm = cellRe.exec(body))) {
      const attrs = cm[1] || '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs);
      const col = ref ? colToIndex(ref[1]) : expectedCol;
      while (cells.length < col) cells.push('');
      expectedCol = col + 1;

      const type = (/\bt="([^"]+)"/.exec(attrs) || [, 'n'])[1];
      const styleId = Number((/\bs="(\d+)"/.exec(attrs) || [, -1])[1]);
      const inner = cm[2] || '';
      let value = '';

      if (type === 's') {
        const vm = /<(?:\w+:)?v[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner);
        value = vm ? shared[Number(decodeXml(vm[1]))] ?? '' : '';
      } else if (type === 'inlineStr') {
        const isBlock = /<(?:\w+:)?is>([\s\S]*?)<\/(?:\w+:)?is>/.exec(inner);
        value = isBlock ? textOfRun(isBlock[1]) : '';
      } else if (type === 'str' || type === 'e') {
        const vm = /<(?:\w+:)?v[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner);
        value = vm ? decodeXml(vm[1]) : '';
      } else if (type === 'b') {
        const vm = /<(?:\w+:)?v[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner);
        value = vm && vm[1].trim() === '1' ? 'TRUE' : 'FALSE';
      } else {
        // number - keep the serialized digits verbatim (no float round-trip),
        // unless the cell is date-formatted.
        const vm = /<(?:\w+:)?v[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner);
        const rawNum = vm ? decodeXml(vm[1]).trim() : '';
        if (rawNum !== '' && dateFlags[styleId]) {
          try { value = serialToISO(rawNum); } catch { value = rawNum; }
        } else {
          value = rawNum;
        }
      }

      cells.push(value);
    }
    rows.push(cells);
  }
  return rows;
}

/* --------------------------------------------------------------------- */
/* Public                                                                 */
/* --------------------------------------------------------------------- */

/**
 * Parse an .xlsx buffer into a string grid.
 *
 * @param {Buffer} buf                 raw .xlsx bytes
 * @param {string} [sheetName]         worksheet to read (default: the first)
 * @returns {{ grid: string[][], sheetName: string, sheetNames: string[] }}
 */
export function parseXlsx(buf, sheetName) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  const files = unzip(buf);

  const get = (name) => {
    const hit = files[name] || files[name.replace(/^\//, '')];
    return hit ? hit.toString('utf8') : '';
  };

  const wb = get('xl/workbook.xml');
  if (!wb) throw new Error('That .xlsx has no xl/workbook.xml - it may be corrupt.');

  const sheetDefs = [];
  const sheetRe = /<(?:\w+:)?sheet\b([^>]*)\/>/g;
  let sm;
  while ((sm = sheetRe.exec(wb))) {
    const name = decodeXml((/\bname="([^"]*)"/.exec(sm[1]) || [, ''])[1]);
    const rid = (/\br:id="([^"]*)"/.exec(sm[1]) || [, ''])[1];
    sheetDefs.push({ name, rid });
  }
  if (sheetDefs.length === 0) throw new Error('That .xlsx workbook lists no worksheets.');

  const rels = get('xl/_rels/workbook.xml.rels');
  const relTarget = {};
  const relRe = /<Relationship\b([^>]*)\/>/g;
  let rr;
  while ((rr = relRe.exec(rels))) {
    const id = (/\bId="([^"]*)"/.exec(rr[1]) || [, ''])[1];
    const target = (/\bTarget="([^"]*)"/.exec(rr[1]) || [, ''])[1];
    if (id) relTarget[id] = target;
  }

  const sheetNames = sheetDefs.map((s) => s.name);
  let chosen = sheetDefs[0];
  if (sheetName) {
    const want = String(sheetName).trim().toLowerCase();
    const found = sheetDefs.find((s) => s.name.toLowerCase() === want);
    if (!found) {
      throw new Error(`Worksheet "${sheetName}" not found. Available: ${sheetNames.join(', ')}`);
    }
    chosen = found;
  }

  let target = relTarget[chosen.rid] || `worksheets/sheet${sheetDefs.indexOf(chosen) + 1}.xml`;
  target = target.replace(/^\//, '').replace(/^xl\//, '');
  const sheetXml = get(`xl/${target}`);
  if (!sheetXml) throw new Error(`Could not read worksheet part "xl/${target}" from the .xlsx.`);

  const shared = parseSharedStrings(get('xl/sharedStrings.xml'));
  const dateFlags = parseStyleDateFlags(get('xl/styles.xml'));
  const grid = parseSheet(sheetXml, shared, dateFlags);

  // pad to a rectangle
  const width = grid.reduce((w, r) => Math.max(w, r.length), 0);
  for (const r of grid) while (r.length < width) r.push('');

  return { grid, sheetName: chosen.name, sheetNames };
}
