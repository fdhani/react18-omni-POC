import * as React from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import App from './App';
import BulkActionPaginationPoc from './poc/bulk-action-pagination/BulkActionPaginationPoc';

/**
 * Route table.
 *
 * `/` stays the react-stack-grid repro, unchanged and query-string driven, so
 * the Playwright harness under `harness/` keeps working untouched. Prototypes
 * live on their own paths under `src/poc/` and share nothing with it.
 */
export const POC_ROUTES: Array<{ path: string; title: string }> = [
  { path: '/poc-bulk-action-pagination', title: 'Bulk action + pagination' },
];

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/poc-bulk-action-pagination" element={<BulkActionPaginationPoc />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function NotFound() {
  return (
    <div style={{ padding: 24, font: '14px/1.6 system-ui, sans-serif' }}>
      <h1 style={{ font: '600 18px/1.4 system-ui, sans-serif' }}>Nothing at this path</h1>
      <ul>
        <li>
          <Link to="/">/</Link> — react-stack-grid × React 18 repro
        </li>
        {POC_ROUTES.map((r) => (
          <li key={r.path}>
            <Link to={r.path}>{r.path}</Link> — {r.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
