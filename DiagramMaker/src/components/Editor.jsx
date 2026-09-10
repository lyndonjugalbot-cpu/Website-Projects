import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';
import Sidebar from './Sidebar.jsx';
import Inspector from './Inspector.jsx';
import FlowCanvas from './FlowCanvas.jsx';
import { getDiagram } from '../diagrams/index.js';
import { layoutGraph } from '../lib/layout.js';
import { downloadImage } from '../lib/exportImage.js';
import { saveState, loadState } from '../lib/storage.js';

// Counter for manually added boxes so each gets a unique id.
let boxCount = 1;

// Holds all diagram state and connects the three panels together.
export default function Editor() {
  // Restore the last session once (if any).
  const saved = useMemo(() => loadState(), []);

  // --- core state -----------------------------------------------------
  const [diagramId, setDiagramId] = useState(saved?.diagramId || 'erd');
  const [form, setForm] = useState(saved?.form || getDiagram('erd').sample);
  const [nodes, setNodes, onNodesChange] = useNodesState(saved?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(saved?.edges || []);
  const [selected, setSelected] = useState({ nodeId: null, edgeId: null });
  // Which single panel is shown on a phone: 'input' | 'canvas' | 'edit'.
  // On desktop all three show side by side and this is ignored (see CSS).
  const [mobileView, setMobileView] = useState('canvas');
  // Bumped whenever the canvas should re-fit its view (see FlowCanvas).
  const [fitSignal, setFitSignal] = useState(0);
  const refit = useCallback(() => setFitSignal((n) => n + 1), []);

  // The live selected objects, looked up fresh so edits show immediately.
  const selectedNode = nodes.find((n) => n.id === selected.nodeId) || null;
  const selectedEdge = edges.find((e) => e.id === selected.edgeId) || null;

  // --- build the diagram from the sidebar text ----------------------
  const generate = useCallback(
    (id = diagramId, data = form) => {
      const diagram = getDiagram(id);
      const raw = diagram.generate(data);
      // Drop edges that point at a missing node (typo in the text).
      const ids = new Set(raw.nodes.map((n) => n.id));
      const goodEdges = raw.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
      // Auto-position (a diagram type may supply its own layout), then push to the canvas.
      const placed = diagram.layout
        ? diagram.layout(raw.nodes, goodEdges)
        : layoutGraph(raw.nodes, goodEdges, diagram.direction);
      setNodes(placed);
      setEdges(goodEdges);
      // On a phone, jump to the canvas so the result is visible right away.
      setMobileView('canvas');
      refit();
    },
    [diagramId, form, setNodes, setEdges, refit],
  );

  // Re-fit when the phone switches back to the canvas (it was hidden before).
  useEffect(() => {
    if (mobileView === 'canvas') refit();
  }, [mobileView, refit]);

  // On first load with no saved session, show the ERD example.
  useEffect(() => {
    if (!saved) generate('erd', getDiagram('erd').sample);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save on any change.
  useEffect(() => {
    saveState({ diagramId, form, nodes, edges });
  }, [diagramId, form, nodes, edges]);

  // --- sidebar handlers ------------------------------------------
  // Switch type: load that type's example text and draw it.
  const changeDiagram = (id) => {
    const next = getDiagram(id);
    setDiagramId(id);
    setForm(next.sample);
    generate(id, next.sample);
  };
  const changeForm = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const regenerate = () => {
    if (nodes.length && !window.confirm('Replace the current diagram?')) return;
    generate();
  };
  const resetToExample = () => {
    const sample = getDiagram(diagramId).sample;
    setForm(sample);
    generate(diagramId, sample);
  };

  // --- inspector handlers --------------------------------------
  // Merge a patch into one node's data object.
  const updateNode = (id, patch) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  // Merge a patch into one edge's top-level props (label, type, markerEnd, ...).
  const updateEdge = (id, patch) =>
    setEdges((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  // Delete the current selection (and any edges attached to a deleted node).
  const deleteSelected = () => {
    if (selected.nodeId) {
      setNodes((ns) => ns.filter((n) => n.id !== selected.nodeId));
      setEdges((es) => es.filter((e) => e.source !== selected.nodeId && e.target !== selected.nodeId));
    }
    if (selected.edgeId) setEdges((es) => es.filter((e) => e.id !== selected.edgeId));
    setSelected({ nodeId: null, edgeId: null });
  };
  // Drop a fresh box near the top-left of the canvas.
  const addNode = () => {
    const id = `box-${boxCount++}`;
    setNodes((ns) =>
      ns.concat({
        id,
        type: 'useCase',
        position: { x: 60, y: 60 },
        width: 150,
        height: 60,
        style: { width: 150, height: 60 },
        data: { title: 'New box', color: '#ffffff' },
      }),
    );
  };
  const exportImage = (format) => downloadImage(nodes, format);

  // React Flow reports selection changes; we keep just the first id of each kind.
  const onSelectionChange = useCallback(({ nodes: n, edges: e }) => {
    setSelected({ nodeId: n[0]?.id || null, edgeId: e[0]?.id || null });
  }, []);

  return (
    <div className="app">
      {/* Top bar */}
      <header className="toolbar">
        <strong>Wots Diagram Generator</strong>
        <span className="dm-muted">{getDiagram(diagramId).name}</span>
      </header>

      {/* Phone-only switcher between the three panels (hidden on desktop via CSS) */}
      <nav className="mobile-tabs">
        {[
          ['input', 'Input'],
          ['canvas', 'Diagram'],
          ['edit', 'Edit'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={mobileView === id ? 'active' : ''}
            onClick={() => setMobileView(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="body" data-view={mobileView}>
        <Sidebar
          diagramId={diagramId}
          form={form}
          onDiagramChange={changeDiagram}
          onFormChange={changeForm}
          onGenerate={regenerate}
          onReset={resetToExample}
        />
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          setEdges={setEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onSelectionChange={onSelectionChange}
          fitSignal={fitSignal}
        />
        <Inspector
          node={selectedNode}
          edge={selectedEdge}
          onUpdateNode={updateNode}
          onUpdateEdge={updateEdge}
          onDelete={deleteSelected}
          onAddNode={addNode}
          onExport={exportImage}
        />
      </div>

      {/* Footer credit */}
      <footer className="footer">© 2026 Wots Dev. All rights reserved.</footer>
    </div>
  );
}
