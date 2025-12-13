import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/unexplained-archive/', // GitHub Pages subpath - MUST be absolute
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 800, // Raise limit for complex app
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'stripe': ['@stripe/react-stripe-js', '@stripe/stripe-js'],
          'maps': ['leaflet', 'react-leaflet'],
          'charts': ['recharts'],
        },
      },
    },
  },
});
