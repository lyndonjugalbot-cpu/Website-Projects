import erd from './erd.js';
import useCase from './useCase.js';
import classDiagram from './classDiagram.js';
import activity from './activity.js';

// Every diagram type the app supports, in sidebar order.
export const DIAGRAMS = [erd, useCase, classDiagram, activity];

// Look up one config by id (falls back to the first type).
export function getDiagram(id) {
  return DIAGRAMS.find((d) => d.id === id) || DIAGRAMS[0];
}
