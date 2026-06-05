import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://localhost:8000',
      '/alerts': 'http://localhost:8000',
      '/predict': 'http://localhost:8000',
      '/stream': 'http://localhost:8000',
      '/webcam': 'http://localhost:8000',
      '/stats': 'http://localhost:8000',
      '/cameras': 'http://localhost:8000',
      '/devices': 'http://localhost:8000',
      '/upload-video': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/faces': 'http://localhost:8000',
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
