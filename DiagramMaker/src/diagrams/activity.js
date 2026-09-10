import { lines, parseFlow } from './parse.js';

// Pixel size for each activity-node shape.
const SHAPE_SIZE = {
  start: { width: 56, height: 56 },
  end: { width: 56, height: 56 },
  action: { width: 170, height: 50 },
  decision: { width: 120, height: 120 },
};

// Build an Activity Diagram (flowchart) from the sidebar text.
function generate(form) {
  const nodes = [];
  const edges = [];

  // One step per line:  "id | type | label"   type = start | action | decision | end
  lines(form.steps).forEach((line) => {
    const [id, typeRaw = 'action', label = ''] = line.split('|').map((s) => s.trim());
    const kind = SHAPE_SIZE[typeRaw] ? typeRaw : 'action';
    nodes.push({
      id,
      type: 'activity',
      width: SHAPE_SIZE[kind].width,
      height: SHAPE_SIZE[kind].height,
      data: { title: label, kind, color: '#dbeafe' },
    });
  });

  // One flow per line:  "fromId -> toId : guard"
  lines(form.flows).forEach((line, i) => {
    const { from, to, extras } = parseFlow(line);
    edges.push({
      id: `e-act-${i}`,
      source: from,
      target: to,
      sourceHandle: 'b',
      targetHandle: 't',
      type: 'smoothstep',
      label: extras[0] || '',
      markerEnd: { type: 'arrowclosed' },
    });
  });

  return { nodes, edges };
}

export default {
  id: 'activity',
  name: 'Activity Diagram',
  direction: 'TB',
  generate,
  form: [
    {
      key: 'steps',
      label: 'Steps',
      rows: 8,
      hint: 'id | type | label\ntype = start | action | decision | end',
    },
    { key: 'flows', label: 'Flows', rows: 8, hint: 'fromId -> toId : guard' },
  ],
  sample: {
    steps: [
      's | start | ',
      'login | action | Enter credentials',
      'check | decision | Valid?',
      'home | action | Show dashboard',
      'error | action | Show error message',
      'e | end | ',
    ].join('\n'),
    flows: [
      's -> login',
      'login -> check',
      'check -> home : yes',
      'check -> error : no',
      'error -> login',
      'home -> e',
    ].join('\n'),
  },
};
