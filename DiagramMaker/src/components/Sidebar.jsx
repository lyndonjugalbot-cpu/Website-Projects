import { DIAGRAMS, getDiagram } from '../diagrams/index.js';

// Left panel: choose a diagram type, fill in the text fields, press Generate.
export default function Sidebar({
  diagramId,
  form,
  onDiagramChange,
  onFormChange,
  onGenerate,
  onReset,
}) {
  const diagram = getDiagram(diagramId);

  return (
    <aside className="sidebar">
      {/* Diagram type selector */}
      <label className="dm-label">Diagram type</label>
      <select value={diagramId} onChange={(e) => onDiagramChange(e.target.value)}>
        {DIAGRAMS.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>

      {/* One textarea per field defined by the chosen diagram type */}
      {diagram.form.map((field) => (
        <div key={field.key} className="dm-field">
          <label className="dm-label">{field.label}</label>
          <textarea
            rows={field.rows || 5}
            value={form[field.key] || ''}
            onChange={(e) => onFormChange(field.key, e.target.value)}
          />
          {field.hint ? <p className="dm-hint">{field.hint}</p> : null}
        </div>
      ))}

      {/* Rebuild the canvas from the text above */}
      <button className="dm-primary" onClick={onGenerate}>Generate diagram</button>
      <button className="dm-link" onClick={onReset}>Reset to example</button>
      <p className="dm-hint">Generating replaces the current drawing.</p>
    </aside>
  );
}
