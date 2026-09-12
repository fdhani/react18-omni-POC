declare module 'react-stack-grid';
declare module '*.css';

// react-hook-form@6.13.1 ships types (dist/index.d.ts) but its package.json
// "exports" map has no "types" condition, so TypeScript's `moduleResolution:
// bundler` (or node16/nodenext) can't find them -- a real, verified
// incompatibility between this old package and a modern TS resolution mode.
// Runtime is unaffected (Vite/esbuild resolves the JS import fine); this stub
// exists only to let the rest of this smoke test type-check.
declare module 'react-hook-form';
