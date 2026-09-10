import { useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  reconnectEdge,
  getNodesBounds,
  useReactFlow,
  useNodesInitialized,
} from '@xyflow/react';
import { nodeTypes } from '../nodes.jsx';

// Below this width we treat the screen as a phone (matches the CSS breakpoint).
const PHONE = '(max-width: 768px)';

// The editable drawing surface. All diagram state lives in the parent (Editor);
// this component just wires React Flow's callbacks to it.
export default function FlowCanvas({
  nodes,
  edges,
  setEdges,
  onNodesChange,
  onEdgesChange,
  onSelectionChange,
  fitSignal,
}) {
  const wrapRef = useRef(null);
  const { fitView, setViewport, getNodes } = useReactFlow();
  // True once every node has been measured — the safe moment to fit the view.
  const nodesInitialized = useNodesInitialized();

  // Re-fit after a new diagram is generated (nodes re-measured) or after the phone
  // switches back to the canvas (the container was resized while it was hidden).
  useEffect(() => {
    if (!nodesInitialized) return;
    const onPhone = window.matchMedia(PHONE).matches;
    const width = wrapRef.current?.clientWidth || 0;

    if (onPhone && width && getNodes().length) {
      // Phone: scale to fit the width and pin the diagram to the top-left, so a
      // wide diagram starts at the top instead of floating in the middle.
      const b = getNodesBounds(getNodes());
      const margin = 24;
      const zoom = Math.min(1.2, Math.max(0.2, (width - margin * 2) / b.width));
      setViewport({ x: margin - b.x * zoom, y: margin - b.y * zoom, zoom });
    } else {
      // Desktop: normal centred fit.
      fitView({ padding: 0.2 });
    }
  }, [nodesInitialized, fitSignal, fitView, setViewport, getNodes]);

  // New edge: user dragged from one shape's handle to another.
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', markerEnd: { type: 'arrowclosed' } }, eds)),
    [setEdges],
  );

  // Re-route: user dragged an existing edge's endpoint onto a different shape/side.
  const onReconnect = useCallback(
    (oldEdge, newConnection) => setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds)),
    [setEdges],
  );

  return (
    <div className="canvas" ref={wrapRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onSelectionChange={onSelectionChange}
        fitView
        minZoom={0.2}
      >
        {/* Grid, zoom buttons and an overview map. */}
        <Background gap={16} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
