// Right panel: edit the selected shape or line, add a box, or export the image.

// Preset fill colours offered for a shape.
const COLORS = ['#ffffff', '#e0f2fe', '#dcfce7', '#fef9c3', '#fee2e2', '#ede9fe', '#dbeafe'];
// Built-in React Flow edge shapes.
const EDGE_SHAPES = ['smoothstep', 'default', 'straight', 'step'];
// Arrow-head options (React Flow marker types).
const ARROWS = [
  { value: 'arrowclosed', label: 'Solid arrow' },
  { value: 'arrow', label: 'Open arrow' },
  { value: 'none', label: 'None' },
];

// "field:type:key" text -> row objects (used by the ERD entity editor).
function parseRows(text) {
  return splitLines(text).map((line) => {
    const [field, type = '', key = ''] = line.split(':').map((s) => s.trim());
    return { field, type, key: key.toLowerCase() };
  });
}

// Trimmed, non-empty lines.
function splitLines(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

export default function Inspector({ node, edge, onUpdateNode, onUpdateEdge, onDelete, onAddNode, onExport }) {
  return (
    <aside className="inspector">
      <h3 className="dm-h3">Inspector</h3>

      {/* -------- editing a shape -------- */}
      {node ? (
        <div className="dm-field">
          {/* Label / name */}
          <label className="dm-label">Label</label>
          <input
            value={node.data.title || ''}
            onChange={(e) => onUpdateNode(node.id, { title: e.target.value })}
          />

          {/* ERD attribute rows */}
          {node.data.rows ? (
            <>
              <label className="dm-label">Attributes (field:type:key per line)</label>
              <textarea
                rows={5}
                value={node.data.rows
                  .map((r) => [r.field, r.type, r.key].filter(Boolean).join(':'))
                  .join('\n')}
                onChange={(e) => onUpdateNode(node.id, { rows: parseRows(e.target.value) })}
              />
            </>
          ) : null}

          {/* UML class members */}
          {node.data.attributes ? (
            <>
              <label className="dm-label">Attributes (one per line)</label>
              <textarea
                rows={4}
                value={node.data.attributes.join('\n')}
                onChange={(e) => onUpdateNode(node.id, { attributes: splitLines(e.target.value) })}
              />
              <label className="dm-label">Methods (one per line)</label>
              <textarea
                rows={4}
                value={node.data.methods.join('\n')}
                onChange={(e) => onUpdateNode(node.id, { methods: splitLines(e.target.value) })}
              />
            </>
          ) : null}

          {/* Fill colour */}
          <label className="dm-label">Colour</label>
          <div className="dm-swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                className="dm-swatch"
                style={{ background: c }}
                onClick={() => onUpdateNode(node.id, { color: c })}
              />
            ))}
          </div>

          <button className="dm-danger" onClick={onDelete}>Delete shape</button>
        </div>
      ) : null}

      {/* -------- editing a line -------- */}
      {edge ? (
        <div className="dm-field">
          <label className="dm-label">Line label</label>
          <input
            value={edge.label || ''}
            onChange={(e) => onUpdateEdge(edge.id, { label: e.target.value })}
          />

          <label className="dm-label">Line style</label>
          <select
            value={edge.type || 'default'}
            onChange={(e) => onUpdateEdge(edge.id, { type: e.target.value })}
          >
            {EDGE_SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <label className="dm-label">Arrow head</label>
          <select
            value={edge.markerEnd?.type || 'none'}
            onChange={(e) =>
              onUpdateEdge(edge.id, {
                markerEnd: e.target.value === 'none' ? undefined : { type: e.target.value },
              })
            }
          >
            {ARROWS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>

          <label className="dm-check">
            <input
              type="checkbox"
              checked={edge.style?.strokeDasharray != null}
              onChange={(e) =>
                onUpdateEdge(edge.id, {
                  style: { ...(edge.style || {}), strokeDasharray: e.target.checked ? '6 4' : undefined },
                })
              }
            />
            Dashed
          </label>

          <label className="dm-check">
            <input
              type="checkbox"
              checked={!!edge.animated}
              onChange={(e) => onUpdateEdge(edge.id, { animated: e.target.checked })}
            />
            Animated
          </label>

          <button className="dm-danger" onClick={onDelete}>Delete line</button>
        </div>
      ) : null}

      {/* -------- nothing selected -------- */}
      {!node && !edge ? (
        <p className="dm-hint">
          Click a shape or line to edit it. Drag between the dots on a shape to connect two shapes;
          drag a line&apos;s endpoint to re-route it. Press Delete to remove a selection.
        </p>
      ) : null}

      <hr className="dm-hr" />

      {/* Always available */}
      <button onClick={onAddNode}>+ Add box</button>
      <div className="dm-row-btns">
        <button onClick={() => onExport('png')}>Export PNG</button>
        <button onClick={() => onExport('svg')}>Export SVG</button>
      </div>
    </aside>
  );
}
