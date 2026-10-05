import path from 'path';
import { defineConfig } from 'vite';

/**
 * Standalone build of the page overlay ("Demo Day"): one self-contained IIFE
 * that a bookmarklet, the LOK button or a browser extension can load on any
 * page. Deliberately has no React, Tailwind, audio or Supabase plugins -- the
 * engine + renderer + data it imports are plain TypeScript.
 */
export default defineConfig({
  // The game's public/ folder is 8+ MB of art and music; the overlay uses none of it.
  publicDir: false,
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/overlay'),
    emptyOutDir: true,
    target: 'es2020',
    minify: 'esbuild',
    reportCompressedSize: true,
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/overlay/main.ts'),
      name: 'Survivor616DemoDayBundle',
      formats: ['iife'],
      fileName: () => 'demoday.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
