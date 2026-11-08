import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Uploaded room-type photos served by the backend at /uploads/**.
      // Lets a stored relative path (/uploads/room-types/xxx.jpg) load in dev
      // even when an <img> uses it verbatim instead of resolveImageUrl().
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});