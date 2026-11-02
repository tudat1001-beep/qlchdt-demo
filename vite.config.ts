import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS === 'true' && repositoryName ? `/${repositoryName}/` : '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react-dom/') || id.includes('/node_modules/react/')) return 'react-vendor';
        },
      },
    },
  },
  server: {
    port: Number(process.env.WEB_PORT ?? 5175), strictPort: true,
    proxy: { '/api': process.env.API_PROXY ?? 'http://127.0.0.1:3001' },
  },
});
