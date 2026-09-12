import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const nm = (p: string) => path.resolve(here, 'node_modules', p);

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    // The two apps share one source tree in ../shared but must never share a
    // React copy. Bare imports from ../shared would resolve above both apps,
    // so pin them explicitly to THIS app's node_modules.
    alias: [
      { find: /^react$/, replacement: nm('react') },
      { find: /^react-dom$/, replacement: nm('react-dom') },
      { find: /^react-dom\/client$/, replacement: nm('react-dom/client') },
      { find: /^react\/jsx-runtime$/, replacement: nm('react/jsx-runtime') },
      { find: /^react\/jsx-dev-runtime$/, replacement: nm('react/jsx-dev-runtime') },
      { find: /^react-stack-grid$/, replacement: nm('react-stack-grid') },
    ],
  },
  server: { fs: { allow: [path.resolve(here, '..')] } },
  build: { outDir: 'dist', sourcemap: true },
});
