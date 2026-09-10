import dagre from '@dagrejs/dagre';

// Give every node an (x, y) position using dagre's layered layout.
// direction: 'LR' for structural diagrams, 'TB' for top-down activity flows.
export function layoutGraph(nodes, edges, direction = 'LR') {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: direction, nodesep: 45, ranksep: 80, marginx: 20, marginy: 20 });

  // Register each node's size so dagre spaces them without overlap.
  nodes.forEach((n) => graph.setNode(n.id, { width: n.width || 170, height: n.height || 60 }));
  edges.forEach((e) => graph.setEdge(e.source, e.target));

  dagre.layout(graph);

  // dagre reports the node centre; React Flow positions from the top-left corner.
  return nodes.map((n) => {
    const width = n.width || 170;
    const height = n.height || 60;
    const { x, y } = graph.node(n.id);
    const isTable = n.type === 'entity' || n.type === 'umlClass';
    return {
      ...n,
      position: { x: x - width / 2, y: y - height / 2 },
      // Fix the drawn width so it matches the layout; table nodes grow by content.
      style: { ...(n.style || {}), width, ...(isTable ? {} : { height }) },
    };
  });
}
