/**
 * GSheetTool - Apps Script edition
 * =================================
 * Cleans a contact sheet directly inside Google Sheets:
 *   1. Combines the first-name and last-name columns into one "Full Name" column.
 *   2. Normalises the phone column to the plain local form "0XXXXXXXXX"
 *      (leading zero, no spaces; "+64" / "0064" / "64" and a leading
 *      apostrophe are stripped).
 *
 * Handled phone shapes:
 *   02904343199    -> 02904343199
 *   2904343199.    -> 02904343199
 *   +642904343199  -> 02904343199
 *   290434319      -> 0290434319
 *
 * Install
 * -------
 *   Extensions > Apps Script  ->  paste this file  ->  Save  ->  reload the sheet.
 *   A "GSheet Tool" menu appears. Run "Preview" first, then "Fix names + phones".
 *
 * The columns are auto-detected from the header row. If your sheet has no
 * headers (e.g. plain "Column 1" / "Column 2"), set the CONFIG values below to
 * column letters ("A") or 1-based numbers ("1").
 *
 * Have an .xlsx file instead? Either open it in Google Sheets (File -> Open, or
 * "Save as Google Sheets") and run this, or use the web app / Python CLI, which
 * both read .xlsx directly.
 */

var CONFIG = {
  headerRow: 1,          // row number that holds the column titles
  firstNameHeader: '',   // '' = auto-detect; or a header name / 'A' / '1'
  lastNameHeader: '',
  phoneHeader: '',
  fullNameHeader: 'Full Name', // combined-name column; created if missing
};

var COUNTRY_CODE = '64';

var FIRST_PATTERNS = [/^first[\s_]*name$/i, /^f[\s_]*name$/i, /^given[\s_]*name$/i, /first\s*name/i, /^first$/i, /^fname$/i];
var LAST_PATTERNS  = [/^last[\s_]*name$/i, /^l[\s_]*name$/i, /^surname$/i, /^family[\s_]*name$/i, /last\s*name/i, /^last$/i, /^lname$/i];
var PHONE_PATTERNS = [/phone/i, /mobile/i, /\bcell\b/i, /contact.*(number|no\b)/i, /^number$/i, /telephone/i, /\btel\b/i, /msisdn/i];
var NAME_TARGET_PATTERNS = [/^full[\s_]*name$/i, /^name$/i, /^full$/i, /^customer[\s_]*name$/i, /^contact[\s_]*name$/i];

/* ---------------------------------------------------------------------- */
/* Menu                                                                   */
/* ---------------------------------------------------------------------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GSheet Tool')
    .addItem('Preview (no changes)', 'previewActiveSheet')
    .addItem('Fix names + phone numbers', 'fixActiveSheet')
    .addToUi();
}

function previewActiveSheet() { run_(true); }
function fixActiveSheet() { run_(false); }

/* ---------------------------------------------------------------------- */
/* Phone normalisation                                                    */
/* ---------------------------------------------------------------------- */

function toNational_(raw) {
  var text = String(raw == null ? '' : raw).trim().replace(/^'+/, '').trim();
  if (!text) return null;

  var digits = text.replace(/\D+/g, '');
  if (!digits) return null;

  var international = text.charAt(0) === '+' || digits.indexOf('00') === 0;

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

/** Returns "0" + national digits, or null if the value holds no usable number. */
function normalisePhone_(raw) {
  var national = toNational_(raw);
  if (national == null) return null;
  return '0' + national;
}

/* ---------------------------------------------------------------------- */
/* Column resolution                                                      */
/* ---------------------------------------------------------------------- */

function columnLetterToIndex_(letters) {
  var idx = 0;
  var upper = letters.toUpperCase();
  for (var i = 0; i < upper.length; i++) {
    idx = idx * 26 + (upper.charCodeAt(i) - 64);
  }
  return idx - 1;
}

function resolveColumn_(headers, configured, patterns) {
  if (configured) {
    var spec = String(configured).trim();
    if (/^[0-9]+$/.test(spec)) return parseInt(spec, 10) - 1;
    if (/^[A-Za-z]{1,3}$/.test(spec)) return columnLetterToIndex_(spec);
    var want = spec.toLowerCase();
    for (var i = 0; i < headers.length; i++) {
      if (headers[i].toLowerCase() === want) return i;
    }
    for (var j = 0; j < headers.length; j++) {
      if (headers[j].toLowerCase().indexOf(want) !== -1) return j;
    }
    return -1;
  }
  for (var p = 0; p < patterns.length; p++) {
    for (var k = 0; k < headers.length; k++) {
      if (patterns[p].test(headers[k])) return k;
    }
  }
  return -1;
}

/* ---------------------------------------------------------------------- */
/* Main                                                                   */
/* ---------------------------------------------------------------------- */

function run_(previewOnly) {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var values = sheet.getDataRange().getValues();

  if (values.length < CONFIG.headerRow + 1) {
    ui.alert('GSheet Tool', 'No data rows found on "' + sheet.getName() + '".', ui.ButtonSet.OK);
    return;
  }

  var headerIndex = CONFIG.headerRow - 1;
  var headers = values[headerIndex].map(function (h) { return String(h).trim(); });

  var firstIdx = resolveColumn_(headers, CONFIG.firstNameHeader, FIRST_PATTERNS);
  var lastIdx  = resolveColumn_(headers, CONFIG.lastNameHeader, LAST_PATTERNS);
  var phoneIdx = resolveColumn_(headers, CONFIG.phoneHeader, PHONE_PATTERNS);

  var nameIdx = resolveColumn_(headers, CONFIG.fullNameHeader, NAME_TARGET_PATTERNS);
  var createdNameCol = false;
  if (nameIdx === -1) {
    nameIdx = headers.length;
    headers.push(CONFIG.fullNameHeader);
    createdNameCol = true;
  }

  var width = Math.max(headers.length, values[headerIndex].length);
  var report = { rows: 0, names: 0, fixed: 0, ok: 0, failed: [] };

  for (var r = CONFIG.headerRow; r < values.length; r++) {
    var row = values[r];
    while (row.length < width) row.push('');
    report.rows++;

    if (firstIdx !== -1 && lastIdx !== -1) {
      var parts = [
        String(row[firstIdx] == null ? '' : row[firstIdx]).trim(),
        String(row[lastIdx] == null ? '' : row[lastIdx]).trim()
      ].filter(function (s) { return s.length > 0; });
      var full = parts.join(' ');
      if (full) {
        if (String(row[nameIdx] == null ? '' : row[nameIdx]).trim() !== full) report.names++;
        row[nameIdx] = full;
      }
    }

    if (phoneIdx !== -1) {
      var current = String(row[phoneIdx] == null ? '' : row[phoneIdx]).trim();
      if (current) {
        var fixed = normalisePhone_(row[phoneIdx]);
        if (fixed == null) {
          report.failed.push('Row ' + (r + 1) + ': "' + current + '"');
        } else if (fixed !== current) {
          row[phoneIdx] = fixed;
          report.fixed++;
        } else {
          report.ok++;
        }
      }
    }

    values[r] = row;
  }

  while (values[headerIndex].length < width) values[headerIndex].push('');
  if (createdNameCol) values[headerIndex][nameIdx] = CONFIG.fullNameHeader;

  if (!previewOnly) {
    sheet.getRange(1, 1, values.length, width).setValues(values);
  }

  var summary = [
    previewOnly ? 'PREVIEW - nothing was written.' : 'Done - sheet updated.',
    '',
    'Sheet:              ' + sheet.getName(),
    'Data rows:          ' + report.rows,
    'First-name column:  ' + (firstIdx === -1 ? 'NOT FOUND' : headers[firstIdx]),
    'Last-name column:   ' + (lastIdx === -1 ? 'NOT FOUND' : headers[lastIdx]),
    'Phone column:       ' + (phoneIdx === -1 ? 'NOT FOUND' : headers[phoneIdx]),
    'Full-name column:   ' + headers[nameIdx] + (createdNameCol ? ' (created)' : ''),
    '',
    'Names combined:     ' + report.names,
    'Phones fixed:       ' + report.fixed,
    'Phones already OK:  ' + report.ok,
    'Phones unparseable: ' + report.failed.length
  ].concat(report.failed.slice(0, 30)).join('\n');

  ui.alert('GSheet Tool', summary, ui.ButtonSet.OK);
}
