import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    port: 3000,
    host: true,   // expose on LAN — phone reaches https://192.168.x.x:3000
    https: true,  // required for DeviceMotionEvent on mobile browsers
    proxy: {
      // Proxy /api/* → backend on port 8000, avoids mixed-content block
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
