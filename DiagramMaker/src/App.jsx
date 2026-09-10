import { ReactFlowProvider } from '@xyflow/react';
import Editor from './components/Editor.jsx';

// React Flow's own styles first, then our overrides.
import '@xyflow/react/dist/style.css';
import './index.css';

// The provider shares one React Flow store with every child (canvas + panels).
export default function App() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}
