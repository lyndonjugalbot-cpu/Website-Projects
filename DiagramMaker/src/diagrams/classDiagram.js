import { lines, parts, parseFlow, boxHeight } from './parse.js';

// How each relationship keyword is drawn.
// (React Flow only ships arrow heads, so aggregation/composition use a label mark.)
const RELATIONSHIPS = {
  inheritance: { markerEnd: { type: 'arrowclosed' }, dashed: false, mark: '' },
  association: { markerEnd: { type: 'arrow' }, dashed: false, mark: '' },
  dependency: { markerEnd: { type: 'arrow' }, dashed: true, mark: '' },
  aggregation: { markerEnd: { type: 'arrow' }, dashed: false, mark: '◇ ' }, // hollow diamond
  composition: { markerEnd: { type: 'arrow' }, dashed: false, mark: '◆ ' }, // filled diamond
};

// Build a UML Class Diagram from the sidebar text.
function generate(form) {
  const nodes = [];
  const edges = [];

  // One class per line:  "Name | +id:int, -name:string | +login(), +logout()"
  lines(form.classes).forEach((line) => {
    const [namePart, attrPart = '', methodPart = ''] = line.split('|');
    const name = namePart.trim();
    const attributes = parts(attrPart);
    const methods = parts(methodPart);
    nodes.push({
      id: name,
      type: 'umlClass',
      width: 210,
      height: boxHeight(attributes.length + methods.length) + 8,
      data: { title: name, attributes, methods, color: '#ede9fe' },
    });
  });

  // One relationship per line:  "Dog -> Animal : inheritance : label"
  lines(form.relationships).forEach((line, i) => {
    const { from, to, extras } = parseFlow(line);
    const kind = (extras[0] || 'association').toLowerCase();
    const label = extras[1] || '';
    const rel = RELATIONSHIPS[kind] || RELATIONSHIPS.association;
    edges.push({
      id: `e-cls-${i}`,
      source: from,
      target: to,
      sourceHandle: 'r',
      targetHandle: 'l',
      type: 'smoothstep',
      label: `${rel.mark}${label}`.trim(),
      markerEnd: rel.markerEnd,
      style: rel.dashed ? { strokeDasharray: '6 4' } : undefined,
    });
  });

  return { nodes, edges };
}

export default {
  id: 'class',
  name: 'Class Diagram',
  direction: 'LR',
  generate,
  form: [
    {
      key: 'classes',
      label: 'Classes',
      rows: 7,
      hint: 'Name | +attr:type, -attr:type | +method(), +method()',
    },
    {
      key: 'relationships',
      label: 'Relationships',
      rows: 5,
      hint: 'A -> B : inheritance | association | aggregation | composition | dependency : label',
    },
  ],
  sample: {
    classes: [
      'Animal | -name:string, -age:int | +eat(), +sleep()',
      'Dog | -breed:string | +bark()',
      'Cat | -indoor:bool | +meow()',
      'Owner | -name:string | +feed(pet)',
    ].join('\n'),
    relationships: [
      'Dog -> Animal : inheritance',
      'Cat -> Animal : inheritance',
      'Owner -> Animal : aggregation : owns',
    ].join('\n'),
  },
};
