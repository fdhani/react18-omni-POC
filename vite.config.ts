import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Single-package Vite app at the repository root. Keeping it at the root (rather
// than in a subdirectory) is deliberate: Vercel auto-detects a nested Vite app
// as the project Root Directory, which silently changes which package.json its
// build command runs against.
//
// No react-virtualized alias here: see src/libtests/ReactVirtualizedDemo.tsx
// for why (deep imports avoid the broken barrel export instead of aliasing
// around it).
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: true },
});
