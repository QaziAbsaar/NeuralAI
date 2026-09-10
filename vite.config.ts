import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative paths so the built renderer loads correctly from file:// inside Electron.
  base: './',
  build: {
    outDir: 'dist',
  },
})
