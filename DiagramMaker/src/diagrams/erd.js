import { lines, parts, parseFlow, boxHeight } from './parse.js';

// Build an Entity Relationship Diagram from the sidebar text.
function generate(form) {
  const nodes = [];
  const edges = [];

  // One entity per line:  "User | id:int:pk, name:varchar, email:varchar"
  lines(form.entities).forEach((line) => {
    const [namePart, attrsPart = ''] = line.split('|');
    const name = namePart.trim();
    // Each attribute chunk is "field:type:key" (type and key optional).
    const rows = parts(attrsPart).map((chunk) => {
      const [field, type = '', key = ''] = chunk.split(':').map((s) => s.trim());
      return { field, type, key: key.toLowerCase() };
    });
    nodes.push({
      id: name,
      type: 'entity',
      width: 200,
      height: boxHeight(rows.length),
      data: { title: name, rows, color: '#e0f2fe' },
    });
  });

  // One relationship per line:  "User -> Order : 1-N : places"
  lines(form.relationships).forEach((line, i) => {
    const { from, to, extras } = parseFlow(line);
    const [cardinality = '', label = ''] = extras;
    edges.push({
      id: `e-erd-${i}`,
      source: from,
      target: to,
      sourceHandle: 'r',
      targetHandle: 'l',
      type: 'smoothstep',
      label: [cardinality, label].filter(Boolean).join('  '),
      markerEnd: { type: 'arrowclosed' },
    });
  });

  return { nodes, edges };
}

// Config shown in the sidebar for this diagram type.
export default {
  id: 'erd',
  name: 'ERD — Entity Relationship',
  direction: 'LR',
  generate,
  form: [
    {
      key: 'entities',
      label: 'Entities',
      rows: 7,
      hint: 'One per line:\nName | field:type:pk, field:type',
    },
    {
      key: 'relationships',
      label: 'Relationships',
      rows: 5,
      hint: 'One per line:\nEntityA -> EntityB : 1-N : label',
    },
  ],
  // Example that loads when this type is picked.
  sample: {
    entities: [
      'User | id:int:pk, name:varchar, email:varchar',
      'Order | id:int:pk, user_id:int:fk, total:decimal, created_at:datetime',
      'Product | id:int:pk, name:varchar, price:decimal',
      'OrderItem | id:int:pk, order_id:int:fk, product_id:int:fk, qty:int',
    ].join('\n'),
    relationships: [
      'User -> Order : 1-N : places',
      'Order -> OrderItem : 1-N : contains',
      'Product -> OrderItem : 1-N : listed in',
    ].join('\n'),
  },
};
