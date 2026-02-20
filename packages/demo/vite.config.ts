import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      // Polyfill Node.js zlib with pako for browser compatibility
      zlib: '/src/zlib-polyfill.ts',
    },
  },
  define: {
    // Define Node.js globals that might be needed
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  optimizeDeps: {
    include: ['pako'],
  },
});
