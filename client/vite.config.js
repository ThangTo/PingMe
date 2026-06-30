import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: 'localhost',
    port: 5173,
    hmr: {
      host: 'localhost',
      protocol: 'ws',
    },
  },
  build: {
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((dep) => !dep.includes('/lottie-') && !dep.startsWith('assets/lottie-')),
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('lottie-react') || id.includes('lottie-web')) return 'lottie';
          if (id.includes('react-router-dom')) return 'react-router';
          if (id.includes('react-dom') || id.includes('react')) return 'react-core';
          if (id.includes('socket.io-client') || id.includes('engine.io-client')) return 'realtime';
          if (id.includes('react-virtuoso')) return 'virtual-list';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('lucide-react')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
});
