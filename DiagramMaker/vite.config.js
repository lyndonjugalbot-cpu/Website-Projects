import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Minimal Vite + React setup. Dev server runs on http://localhost:5173
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false },
});
