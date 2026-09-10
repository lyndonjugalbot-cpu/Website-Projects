// Small text helpers shared by every diagram generator.
// The sidebar collects plain text; these turn it into structured data.

// Split a textarea value into trimmed, non-empty lines.
export function lines(text) {
  return (text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

// Turn a comma-separated string into clean parts ("a, b ,c" -> ["a","b","c"]).
export function parts(text) {
  return lines((text || '').split(',').join('\n'));
}

// Parse "from -> to : extra1 : extra2" into its pieces.
// The arrow is split first, then any colons on the right-hand side.
export function parseFlow(line) {
  const [left, ...afterArrow] = line.split('->');
  const [right, ...extras] = afterArrow.join('->').split(':');
  return {
    from: left.trim(),
    to: (right || '').trim(),
    extras: extras.map((s) => s.trim()).filter(Boolean),
  };
}

// Rough pixel height for a titled box that holds `rowCount` text rows.
export function boxHeight(rowCount) {
  return 34 + rowCount * 22;
}
