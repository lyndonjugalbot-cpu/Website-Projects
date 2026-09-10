import { Handle, Position } from '@xyflow/react';

// A source + target handle on all four sides of a shape.
// This lets an edge attach anywhere and be re-routed to any side later.
function AllHandles() {
  return ['Top', 'Right', 'Bottom', 'Left'].flatMap((side) => {
    const id = side[0].toLowerCase(); // 't' | 'r' | 'b' | 'l'
    return [
      <Handle key={`s-${id}`} id={id} type="source" position={Position[side]} className="dm-handle" />,
      <Handle key={`t-${id}`} id={id} type="target" position={Position[side]} className="dm-handle" />,
    ];
  });
}

// --- ERD entity: coloured title bar + one row per attribute --------------
function EntityNode({ data }) {
  return (
    <div className="dm-node dm-table">
      <div className="dm-table-title" style={{ background: data.color }}>{data.title}</div>
      <div className="dm-table-body">
        {(data.rows || []).map((row, i) => (
          <div key={i} className="dm-row">
            {/* PK / FK badge, when set */}
            {row.key ? <span className="dm-badge">{row.key.toUpperCase()}</span> : null}
            <span>{row.field}{row.type ? `: ${row.type}` : ''}</span>
          </div>
        ))}
      </div>
      <AllHandles />
    </div>
  );
}

// --- UML class: three compartments (name / attributes / methods) --------
function ClassNode({ data }) {
  return (
    <div className="dm-node dm-table">
      <div className="dm-table-title" style={{ background: data.color }}>{data.title}</div>
      <div className="dm-table-body">
        {(data.attributes || []).map((a, i) => <div key={i} className="dm-row">{a}</div>)}
      </div>
      <div className="dm-table-body dm-divider">
        {(data.methods || []).map((m, i) => <div key={i} className="dm-row">{m}</div>)}
      </div>
      <AllHandles />
    </div>
  );
}

// --- Use-case actor: simple SVG stick figure with the name underneath ---
function ActorNode({ data }) {
  return (
    <div className="dm-node dm-actor">
      <svg width="46" height="66" viewBox="0 0 46 66" stroke="#111827" strokeWidth="2" fill="none">
        <circle cx="23" cy="10" r="9" fill={data.color} />
        <line x1="23" y1="19" x2="23" y2="44" />
        <line x1="7" y1="29" x2="39" y2="29" />
        <line x1="23" y1="44" x2="11" y2="63" />
        <line x1="23" y1="44" x2="35" y2="63" />
      </svg>
      <div className="dm-actor-name">{data.title}</div>
      <AllHandles />
    </div>
  );
}

// --- Use case: a labelled ellipse -------------------------------------
function UseCaseNode({ data }) {
  return (
    <div className="dm-node dm-usecase" style={{ background: data.color }}>
      <span>{data.title}</span>
      <AllHandles />
    </div>
  );
}

// --- Activity: shape switches on data.kind (start/end/decision/action) --
function ActivityNode({ data }) {
  const kind = data.kind || 'action';
  return (
    <div className={`dm-node dm-activity dm-${kind}`} style={{ background: data.color }}>
      <span>{data.title}</span>
      <AllHandles />
    </div>
  );
}

// Maps the `type` string on a node object to the component that draws it.
// Declared once here so the reference stays stable across renders.
export const nodeTypes = {
  entity: EntityNode,
  umlClass: ClassNode,
  actor: ActorNode,
  useCase: UseCaseNode,
  activity: ActivityNode,
};
