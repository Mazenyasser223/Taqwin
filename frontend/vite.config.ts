import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.VITE_BACKEND_PORT || env.BACKEND_PORT || '4000';
  const backendTarget = `http://127.0.0.1:${backendPort}`;
  const wsTarget = `ws://127.0.0.1:${backendPort}`;

  return {
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/ws': {
        target: wsTarget,
        ws: true,
        changeOrigin: true,
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/health': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: backendTarget, changeOrigin: true },
      '/ws': { target: wsTarget, ws: true, changeOrigin: true },
      '/uploads': { target: backendTarget, changeOrigin: true },
      '/health': { target: backendTarget, changeOrigin: true },
    },
  },
  plugins: [
    react(),
    VitePWA({
      devOptions: { enabled: false },
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'logo.png', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            if (id.includes('/features/workouts/ExerciseDetailModal')) return 'workout-detail-modal';
            if (id.includes('/features/workouts/RoutineLibraryPanel')) return 'workout-routines';
            return;
          }
          if (id.includes('three') || id.includes('@react-three')) return 'vendor-three';
          if (id.includes('apexcharts') || id.includes('recharts')) return 'vendor-charts';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
        },
      },
    },
  },
  };
});
