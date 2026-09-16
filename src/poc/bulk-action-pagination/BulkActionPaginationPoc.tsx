import * as React from 'react';

/**
 * Prototype: bulk actions over a paginated list.
 *
 * Deliberately standalone -- it imports nothing from the repro at `/` and owns
 * its own state, styles and mock data, so it can be thrown away or lifted out
 * without touching anything else in this repository.
 */
export default function BulkActionPaginationPoc() {
  return (
    <main
      style={{
        maxWidth: 880,
        margin: '0 auto',
        padding: 24,
        font: '14px/1.6 system-ui, -apple-system, Segoe UI, sans-serif',
        color: '#101828',
      }}
    >
      <h1 style={{ font: '600 20px/1.4 system-ui, sans-serif', margin: '0 0 8px' }}>
        Bulk action + pagination
      </h1>
      <p style={{ color: '#667085', margin: 0 }}>
        Route is live at <code>/poc-bulk-action-pagination</code>. The prototype itself is not
        implemented yet.
      </p>
    </main>
  );
}
