// Shared table: same header style, spacing and horizontal scroll on small screens.
// Pages pass the columns and render their own <tr> rows.

import type { ReactNode } from 'react';

export interface Column {
  label: string;
  align?: 'left' | 'right';
  hidden?: boolean; // label only for screen readers (e.g. an actions column)
}

interface TableProps {
  columns: Column[];
  children: ReactNode;
}

export function Table({ columns, children }: TableProps) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.label} className={column.align === 'right' ? 'align-right' : undefined}>
                {column.hidden ? <span className="sr-only">{column.label}</span> : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// Content of a cell without a value: the cell looks empty, screen readers hear
// `label` (e.g. "No reason") instead of skipping it.
export function NoValue({ label }: { label: string }) {
  return <span className="sr-only">{label}</span>;
}

// Right-aligned cell holding row buttons.
export function ActionsCell({ children }: { children?: ReactNode }) {
  return (
    <td className="align-right">
      <div className="row-actions">{children}</div>
    </td>
  );
}
