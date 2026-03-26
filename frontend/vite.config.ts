import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8500,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8501',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    port: 8500,
    strictPort: true,
  },
});
