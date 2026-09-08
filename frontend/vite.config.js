import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Frontend runs on :5173, backend on :5000 — proxy /api and /generated
// so the browser can call fetch('/api/...') without CORS headaches.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/generated': 'http://localhost:5000',
    },
  },
});
