import { toPng, toSvg } from 'html-to-image';
import { getNodesBounds } from '@xyflow/react';

// Save the current diagram as a PNG or SVG file.
// We render the React Flow "viewport" element at a transform that fits every node.
export function downloadImage(nodes, format = 'png') {
  const viewport = document.querySelector('.react-flow__viewport');
  if (!viewport || nodes.length === 0) return;

  // Bounding box of all nodes, plus a margin so nothing touches the edge.
  const PAD = 40;
  const bounds = getNodesBounds(nodes);
  const width = Math.round(bounds.width + PAD * 2);
  const height = Math.round(bounds.height + PAD * 2);

  // Shift the drawing so its top-left corner lands at (PAD, PAD) in the image.
  const style = {
    width: `${width}px`,
    height: `${height}px`,
    transform: `translate(${PAD - bounds.x}px, ${PAD - bounds.y}px) scale(1)`,
  };
  const options = { backgroundColor: '#ffffff', width, height, style, pixelRatio: 2 };

  const render = format === 'svg' ? toSvg : toPng;
  render(viewport, options).then((dataUrl) => {
    // Click a temporary link to trigger the browser download.
    const link = document.createElement('a');
    link.download = `diagram.${format}`;
    link.href = dataUrl;
    link.click();
  });
}
