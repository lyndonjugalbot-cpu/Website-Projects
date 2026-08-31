/**
 * GSheetTool - Apps Script edition
 * =================================
 * Combines each row's first-name and last-name columns into one "Full Name"
 * column, directly inside Google Sheets. Every other column is left untouched.
 *
 *   Frist Name: Derek   Last Name: Keen   ->   Full Name: Derek Keen
 *
 * Install
 * -------
 *   Extensions > Apps Script  ->  paste this file  ->  Save  ->  reload the sheet.
 *   A "GSheet Tool" menu appears. Run "Preview" first, then "Combine names".
 *
 * The name columns are auto-detected from the header row (first name also
 * matches the common typo "Frist Name"). If your sheet has no headers, or
 * detection picks the wrong column, set the CONFIG values below to a header
 * name, a column letter ("A"), or a 1-based number ("1").
 *
 * Have an .xlsx file instead? Either open it in Google Sheets (File -> Open, or
 * "Save as Google Sheets") and run this, or use the web app / Python CLI, which
 * both read .xlsx directly.
 */

var CONFIG = {
  headerRow: 1,          // row number that holds the column titles
  firstNameHeader: '',   // '' = auto-detect; or a header name / 'A' / '1'
  lastNameHeader: '',
  fullNameHeader: 'Full Name', // combined-name column; created if missing
};

// Exact spellings first (incl. "frist", the most common typo of "first"), then
// short forms, then a word-boundaried loose match - the boundary stops compound
// headers like "LicenseFirstName" from being picked up.
var FIRST_PATTERNS = [
  /^first[\s_]*name$/i, /^frist[\s_]*name$/i, /^fname$/i, /^f[\s_]*name$/i,
  /^given[\s_]*name$/i, /^first$/i,
  /\b(?:first|frist)[\s_]*name\b/i
];
var LAST_PATTERNS  = [
  /^last[\s_]*name$/i, /^lname$/i, /^l[\s_]*name$/i, /^surname$/i,
  /^family[\s_]*name$/i, /^last$/i,
  /\blast[\s_]*name\b/i
];
var NAME_TARGET_PATTERNS = [/^full[\s_]*name$/i, /^name$/i, /^full$/i, /^customer[\s_]*name$/i, /^contact[\s_]*name$/i];

/* ---------------------------------------------------------------------- */
/* Menu                                                                   */
/* ---------------------------------------------------------------------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GSheet Tool')
    .addItem('Preview (no changes)', 'previewActiveSheet')
    .addItem('Combine names', 'fixActiveSheet')
    .addToUi();
}

function previewActiveSheet() { run_(true); }
function fixActiveSheet() { run_(false); }

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

  var nameIdx = resolveColumn_(headers, CONFIG.fullNameHeader, NAME_TARGET_PATTERNS);
  var createdNameCol = false;
  if (nameIdx === -1) {
    nameIdx = headers.length;
    headers.push(CONFIG.fullNameHeader);
    createdNameCol = true;
  }

  var width = Math.max(headers.length, values[headerIndex].length);
  var report = { rows: 0, names: 0 };

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
    'Full-name column:   ' + headers[nameIdx] + (createdNameCol ? ' (created)' : ''),
    '',
    'Names combined:     ' + report.names,
    '(all other columns were left unchanged)'
  ].join('\n');

  ui.alert('GSheet Tool', summary, ui.ButtonSet.OK);
}
