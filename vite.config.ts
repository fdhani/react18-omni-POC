import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Single-package Vite app at the repository root. Keeping it at the root (rather
// than in a subdirectory) is deliberate: Vercel auto-detects a nested Vite app
// as the project Root Directory, which silently changes which package.json its
// build command runs against.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // react-virtualized's default ESM entry (dist/es/index.js) unconditionally
      // re-exports WindowScroller, whose compiled output is missing a Flow
      // prop-type placeholder export (bpfrpt_proptype_WindowScroller) that a
      // sibling module still imports. esbuild rejects this outright -- `vite
      // dev`/`vite build` fail to even start, regardless of which named export
      // is actually used, and regardless of React version. Aliasing to the
      // CommonJS build sidesteps esbuild's stricter ESM export resolution,
      // which is the standard workaround teams use for this exact bug.
      { find: /^react-virtualized$/, replacement: 'react-virtualized/dist/commonjs/index.js' },
    ],
  },
  build: { outDir: 'dist', sourcemap: true },
});
