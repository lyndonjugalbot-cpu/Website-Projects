import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// SelfLeveling.jsx lives at the project root, so it's already inside the
// dev-server's allowed file scope — no extra fs.allow entry needed.
export default defineConfig({
  plugins: [react()],
})
