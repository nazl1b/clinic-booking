// "21–40 of 57" with Previous / Next buttons under a paged list.

import { Button } from './Button';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav className="pagination" aria-label="Pages">
      <span className="pagination-info tabular">
        {first}–{last} of {total}
      </span>
      <div className="pagination-controls">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          ‹ Previous
        </Button>
        <span className="pagination-page tabular" aria-current="page">
          Page {page} of {pages}
        </span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next ›
        </Button>
      </div>
    </nav>
  );
}
