import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PyWots.jsx and curriculum.js live at the project root, already inside the
// dev-server's allowed file scope — no extra fs.allow entry needed.
export default defineConfig({
  plugins: [react()],
})
