import dagre from '@dagrejs/dagre';
import { lines, parseFlow } from './parse.js';

// Build a Use Case Diagram: use-case ovals in the middle, actors on either side.
function generate(form) {
  const nodes = [];
  const edges = [];
  const actorSide = {}; // actor name -> 'left' | 'right'

  // Actors: one per line. Add "> right" to send an actor to the right column.
  //   "Customer"          -> left
  //   "Admin > right"     -> right
  lines(form.actors).forEach((line) => {
    const [name, sideRaw = ''] = line.split('>').map((s) => s.trim());
    const side = sideRaw.toLowerCase() === 'right' ? 'right' : 'left';
    actorSide[name] = side;
    nodes.push({
      id: `actor:${name}`,
      type: 'actor',
      width: 90,
      height: 118,
      data: { title: name, color: '#fef9c3', side },
    });
  });

  // Use cases: one name per line -> ellipse nodes.
  lines(form.usecases).forEach((name) => {
    nodes.push({
      id: `uc:${name}`,
      type: 'useCase',
      width: 170,
      height: 72,
      data: { title: name, color: '#dcfce7' },
    });
  });

  // Resolve a plain name to an actor id if one exists, otherwise a use-case id.
  const resolve = (name) =>
    nodes.some((n) => n.id === `actor:${name}`) ? `actor:${name}` : `uc:${name}`;

  // Links:  "Actor -> Use case"  or  "Use case -> Use case : include | extend"
  lines(form.links).forEach((line, i) => {
    const { from, to, extras } = parseFlow(line);
    const kind = (extras[0] || '').toLowerCase();
    const source = resolve(from);
    const target = resolve(to);
    // A line that touches a right-side actor runs from the middle outwards to the right.
    const isRight = actorSide[from] === 'right' || actorSide[to] === 'right';
    edges.push({
      id: `e-uc-${i}`,
      source,
      target,
      sourceHandle: isRight ? (source.startsWith('actor:') ? 'l' : 'r') : 'r',
      targetHandle: isRight ? (target.startsWith('actor:') ? 'l' : 'r') : 'l',
      type: 'straight',
      // include / extend get a dashed line + label; plain associations stay simple.
      label: kind ? `«${kind}»` : '',
      style: kind ? { strokeDasharray: '6 4' } : undefined,
      markerEnd: kind ? { type: 'arrow' } : undefined,
    });
  });

  return { nodes, edges };
}

// Push overlapping nodes in a column downwards so they don't collide.
function spread(column, minGap = 18) {
  const sorted = [...column].sort((a, b) => a.position.y - b.position.y);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const limit = prev.position.y + prev.height + minGap;
    if (sorted[i].position.y < limit) sorted[i].position.y = limit;
  }
  return column;
}

// Custom layout: left actors | use cases | right actors (three columns).
function layout(nodes, edges) {
  const actors = nodes.filter((n) => n.type === 'actor');
  const useCases = nodes.filter((n) => n.type === 'useCase');

  // 1. Lay the use cases out in the middle with dagre (handles include/extend links).
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'LR', nodesep: 30, ranksep: 70, marginx: 10, marginy: 10 });
  useCases.forEach((n) => graph.setNode(n.id, { width: n.width, height: n.height }));
  edges.forEach((e) => {
    if (graph.hasNode(e.source) && graph.hasNode(e.target)) graph.setEdge(e.source, e.target);
  });
  dagre.layout(graph);

  const LEFT_COL = 120; // space reserved for the left actor column
  const GAP = 90; // gap between a column and the use-case block

  // Shift the use-case block so its left edge sits just right of the left column.
  const leftEdges = useCases.map((n) => graph.node(n.id).x - n.width / 2);
  const shift = LEFT_COL + GAP - Math.min(...leftEdges, 0);
  const middle = useCases.map((n) => {
    const p = graph.node(n.id);
    return {
      ...n,
      position: { x: p.x - n.width / 2 + shift, y: p.y - n.height / 2 },
      style: { ...(n.style || {}), width: n.width, height: n.height },
    };
  });

  // Bounds of the use-case block (fallbacks keep things sane when there are none).
  const blockRight = middle.length
    ? Math.max(...middle.map((n) => n.position.x + n.width))
    : LEFT_COL + GAP + 200;
  const centres = middle.map((n) => n.position.y + n.height / 2);
  const yMin = Math.min(...centres, 0);
  const yMax = Math.max(...centres, 260);

  // 2. Place each actor column, vertically near the use cases it connects to.
  const placeColumn = (list, x) =>
    list.map((actor, i) => {
      const linkedY = edges
        .filter((e) => e.source === actor.id || e.target === actor.id)
        .map((e) => {
          const otherId = e.source === actor.id ? e.target : e.source;
          const uc = middle.find((n) => n.id === otherId);
          return uc ? uc.position.y + uc.height / 2 : null;
        })
        .filter((v) => v != null);
      // Average of connected use cases, or an even spread if it connects to none.
      const cy = linkedY.length
        ? linkedY.reduce((sum, v) => sum + v, 0) / linkedY.length
        : yMin + ((i + 0.5) / list.length) * (yMax - yMin);
      return {
        ...actor,
        position: { x, y: cy - actor.height / 2 },
        style: { ...(actor.style || {}), width: actor.width, height: actor.height },
      };
    });

  const leftActors = spread(placeColumn(actors.filter((a) => a.data.side !== 'right'), 0));
  const rightActors = spread(placeColumn(actors.filter((a) => a.data.side === 'right'), blockRight + GAP));

  return [...leftActors, ...rightActors, ...middle];
}

export default {
  id: 'usecase',
  name: 'Use Case',
  direction: 'LR',
  generate,
  layout,
  form: [
    {
      key: 'actors',
      label: 'Actors',
      rows: 4,
      hint: 'One name per line\nAdd "> right" to place an actor on the right',
    },
    { key: 'usecases', label: 'Use cases', rows: 7, hint: 'One name per line' },
    {
      key: 'links',
      label: 'Connections',
      rows: 7,
      hint: 'Actor -> Use case\nUse case -> Use case : include',
    },
  ],
  sample: {
    actors: ['Customer', 'Admin > right'].join('\n'),
    usecases: [
      'Browse Products',
      'Add to Cart',
      'Checkout',
      'Make Payment',
      'Manage Products',
      'View Reports',
    ].join('\n'),
    links: [
      'Customer -> Browse Products',
      'Customer -> Add to Cart',
      'Customer -> Checkout',
      'Checkout -> Make Payment : include',
      'Admin -> Manage Products',
      'Admin -> View Reports',
    ].join('\n'),
  },
};
