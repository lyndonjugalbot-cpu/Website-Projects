/**
 * POST /api/clean
 * Body JSON: { url?, gid?, csv?, xlsx?, sheet?, options? }
 *   - url     : a Google Sheets link (fetched server-side as CSV, no CORS issue)
 *   - gid     : worksheet gid override
 *   - csv     : raw CSV text (used instead of url)
 *   - xlsx    : base64-encoded .xlsx file bytes (used instead of url / csv)
 *   - sheet   : worksheet name to read from the .xlsx (default: the first)
 *   - options : { firstCol, lastCol, nameCol }  (name / letter / number)
 *
 * Returns: { headers, rows, changed, columns, report }  or  { error }
 */

import { transform, parseCsv } from '../lib/clean.js';
import { parseXlsx } from '../lib/xlsx.js';

const SHEET_ID_RE = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;
const GID_RE = /[#&?]gid=([0-9]+)/;

function sheetCsvUrl(url, gid) {
  const m = SHEET_ID_RE.exec(url);
  if (!m) throw new Error('That does not look like a Google Sheets URL.');
  let g = gid;
  if (!g) {
    const mm = GID_RE.exec(url);
    g = mm ? mm[1] : '0';
  }
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${encodeURIComponent(g)}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { url, gid, csv, xlsx, sheet, options } = body;

    let csvText;
    let grid;
    let source;

    if (xlsx && String(xlsx).trim()) {
      let buf;
      try {
        buf = Buffer.from(String(xlsx), 'base64');
      } catch {
        res.status(400).json({ error: 'The uploaded .xlsx could not be decoded.' });
        return;
      }
      let parsed;
      try {
        parsed = parseXlsx(buf, sheet ? String(sheet).trim() : undefined);
      } catch (e) {
        res.status(400).json({ error: e && e.message ? e.message : 'Could not read that .xlsx file.' });
        return;
      }
      grid = parsed.grid;
      source = parsed.sheetNames.length > 1
        ? `.xlsx (sheet "${parsed.sheetName}" of ${parsed.sheetNames.length})`
        : '.xlsx upload';
    } else if (csv && String(csv).trim()) {
      csvText = String(csv);
      source = 'pasted CSV';
    } else if (url && String(url).trim()) {
      const exportUrl = sheetCsvUrl(String(url).trim(), gid ? String(gid).trim() : '');
      const resp = await fetch(exportUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': 'GSheetTool/1.0 (+vercel)' },
      });
      const text = await resp.text();
      const head = text.slice(0, 400).trimStart().toLowerCase();
      if (!resp.ok || head.startsWith('<!doctype html') || head.includes('<html')) {
        res.status(400).json({
          error:
            'Google did not return CSV - the sheet is not readable from a link. ' +
            'In Google Sheets: Share -> General access -> "Anyone with the link" -> Viewer, then try again. ' +
            '(Or use the Apps Script version for a private sheet.)',
        });
        return;
      }
      csvText = text;
      source = 'Google Sheet';
    } else {
      res.status(400).json({ error: 'Provide a Google Sheet URL, paste CSV text, or upload an .xlsx file.' });
      return;
    }

    if (!grid) grid = parseCsv(csvText);
    const result = transform(grid, { ...(options || {}), source });
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: err && err.message ? err.message : String(err) });
  }
}
