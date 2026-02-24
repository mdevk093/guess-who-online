import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/presets': 'http://localhost:3001',
      '/defaultCharacters.json': 'http://localhost:3001'
    }
  }
})
