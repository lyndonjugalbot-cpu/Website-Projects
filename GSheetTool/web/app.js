'use strict';

const $ = (id) => document.getElementById(id);

const els = {
  url: $('url'), gid: $('gid'), csv: $('csv'), file: $('file'), sheet: $('sheet'),
  firstCol: $('firstCol'), lastCol: $('lastCol'), nameCol: $('nameCol'),
  run: $('run'), status: $('status'),
  results: $('results'), warnings: $('warnings'), stats: $('stats'), detected: $('detected'),
  download: $('download'), copyTsv: $('copyTsv'), copyNote: $('copyNote'),
  preview: $('preview'), previewNote: $('previewNote'),
};

let lastRows = null; // cleaned grid incl. header
let xlsxB64 = null;   // base64 of an uploaded .xlsx, or null

const PREVIEW_LIMIT = 60;

function abToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function clearXlsx() {
  xlsxB64 = null;
  els.sheet.hidden = true;
}

els.csv.addEventListener('input', () => { if (els.csv.value) clearXlsx(); });
els.url.addEventListener('input', () => { if (els.url.value) clearXlsx(); });

els.file.addEventListener('change', () => {
  const f = els.file.files && els.file.files[0];
  if (!f) return;
  const isXlsx = /\.xlsx$/i.test(f.name) ||
    f.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  if (isXlsx) {
    if (f.size > 4_000_000) {
      setStatus(`${f.name} is large (${(f.size / 1e6).toFixed(1)} MB) - the upload may be rejected. ` +
        'If so, export just the contact sheet as CSV.', true);
    }
    const reader = new FileReader();
    reader.onload = () => {
      xlsxB64 = abToBase64(reader.result);
      els.csv.value = '';
      els.sheet.hidden = false;
      setStatus(`Loaded ${f.name} - click Clean data (first worksheet unless you name one).`);
    };
    reader.onerror = () => setStatus('Could not read that file.', true);
    reader.readAsArrayBuffer(f);
    return;
  }

  const reader = new FileReader();
  reader.onload = () => { clearXlsx(); els.csv.value = String(reader.result || ''); setStatus(`Loaded ${f.name}`); };
  reader.onerror = () => setStatus('Could not read that file.', true);
  reader.readAsText(f);
});

els.run.addEventListener('click', run);
[els.url, els.gid].forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); }));

els.download.addEventListener('click', () => {
  if (!lastRows) return;
  const blob = new Blob([toCsv(lastRows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cleaned-contacts.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

els.copyTsv.addEventListener('click', async () => {
  if (!lastRows) return;
  const tsv = lastRows.map((r) => r.map((c) => String(c == null ? '' : c).replace(/\t/g, ' ')).join('\t')).join('\n');
  try {
    await navigator.clipboard.writeText(tsv);
    els.copyNote.textContent = 'Copied. Paste into cell A1 of your sheet.';
  } catch {
    els.copyNote.textContent = 'Copy failed - use Download instead.';
  }
});

function setStatus(msg, isErr) {
  els.status.textContent = msg || '';
  els.status.classList.toggle('err', !!isErr);
}

function options() {
  const o = {};
  if (els.firstCol.value.trim()) o.firstCol = els.firstCol.value.trim();
  if (els.lastCol.value.trim()) o.lastCol = els.lastCol.value.trim();
  if (els.nameCol.value.trim()) o.nameCol = els.nameCol.value.trim();
  return o;
}

async function run() {
  const url = els.url.value.trim();
  const csv = els.csv.value.trim();
  if (!url && !csv && !xlsxB64) {
    setStatus('Paste a Google Sheet link or some CSV, or upload an .xlsx file first.', true);
    return;
  }

  els.run.disabled = true;
  setStatus('Cleaning...');
  els.copyNote.textContent = '';

  try {
    const resp = await fetch('/api/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        gid: els.gid.value.trim(),
        csv,
        xlsx: xlsxB64 || undefined,
        sheet: els.sheet.value.trim() || undefined,
        options: options(),
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `Request failed (${resp.status})`);
    render(data);
    setStatus('Done.');
  } catch (err) {
    setStatus(err.message || String(err), true);
    els.results.hidden = true;
  } finally {
    els.run.disabled = false;
  }
}

function render(data) {
  const { headers, rows, changed, columns, report } = data;
  lastRows = rows;

  // warnings
  if (report.warnings && report.warnings.length) {
    els.warnings.hidden = false;
    els.warnings.innerHTML = '<strong>Heads up</strong><ul>' +
      report.warnings.map((w) => `<li>${esc(w)}</li>`).join('') + '</ul>';
  } else {
    els.warnings.hidden = true;
  }

  // stats
  els.stats.innerHTML = [
    stat(report.totalRows, 'rows'),
    stat(report.namesCombined, 'names combined', 'good'),
  ].join('');

  els.detected.innerHTML =
    `Detected &mdash; first name: <b>${esc(report.firstNameColumn || 'none')}</b>, ` +
    `last name: <b>${esc(report.lastNameColumn || 'none')}</b>, ` +
    `combined into: <b>${esc(report.fullNameColumn)}</b>${report.fullNameColumnCreated ? ' (new column)' : ''}. ` +
    `All other columns are passed through unchanged.`;

  // preview table
  const body = rows.slice(1, 1 + PREVIEW_LIMIT);
  const thead = '<thead><tr>' + headers.map((h) => `<th>${esc(h)}</th>`).join('') + '</tr></thead>';
  const tbody = '<tbody>' + body.map((r, i) => {
    const flag = changed[i] || {};
    return '<tr>' + headers.map((_, c) => {
      const isChg = c === columns.nameIdx && flag.name;
      return `<td class="${isChg ? 'chg' : ''}">${esc(r[c] == null ? '' : r[c])}</td>`;
    }).join('') + '</tr>';
  }).join('') + '</tbody>';
  els.preview.innerHTML = thead + tbody;
  els.previewNote.textContent = rows.length - 1 > PREVIEW_LIMIT
    ? `Showing first ${PREVIEW_LIMIT} of ${rows.length - 1} rows. Download / copy gets them all.`
    : `${rows.length - 1} row${rows.length - 1 === 1 ? '' : 's'}.`;

  els.results.hidden = false;
  els.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function stat(n, label, cls) {
  return `<div class="stat ${cls || ''}"><b>${n}</b><span>${label}</span></div>`;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function toCsv(grid) {
  return grid.map((r) => r.map((cell) => {
    const s = cell == null ? '' : String(cell);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\r\n');
}
