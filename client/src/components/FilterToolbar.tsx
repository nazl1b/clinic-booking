// Above every list with a search: the list's count on the left (if given), and on
// the right a search box of one fixed width (--search-width) and, for lists with
// filters, a "Filters" button that opens a small popover with them. The button shows how
// many filters differ from the defaults, e.g. "Filters (2)". The values live in
// the URL (the page's hook); the search is written after a short pause
// (useSearchDraft), the filters at once.
//
// The popover closes on Escape (focus back on the button), on a click outside,
// when focus leaves it, and with the button itself; it looks like the user menu.

import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useSearchDraft } from '../hooks/useSearchDraft';
import { Icon } from './layout/Icon';
import { Button } from './ui/Button';
import { SearchInput } from './ui/SearchInput';

interface FilterToolbarProps {
  searchLabel: string; // for screen readers, e.g. "Search doctors"
  placeholder: string;
  search: string; // the search in the URL
  onSearch: (search: string) => void; // writes the URL with { replace: true }; must be stable
  children?: ReactNode; // the filter fields; without them there is no Filters button
  activeFilters?: number; // filters that differ from the defaults
  onClearFilters?: () => void; // back to the defaults (the search stays)
  summary?: ReactNode; // e.g. "32 appointments from today on"
}

export function FilterToolbar({ searchLabel, placeholder, search: urlSearch, onSearch, children, activeFilters = 0, onClearFilters, summary }: FilterToolbarProps) {
  const [search, setSearch] = useSearchDraft(urlSearch, onSearch);

  return (
    <div className="filter-toolbar">
      {summary && <p className="muted">{summary}</p>}
      <div className="filter-toolbar-controls" role="search">
        <SearchInput label={searchLabel} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder} />
        {children && (
          <FilterMenu activeFilters={activeFilters} onClearFilters={onClearFilters}>
            {children}
          </FilterMenu>
        )}
      </div>
    </div>
  );
}

function FilterMenu({ activeFilters, onClearFilters, children }: { activeFilters: number; onClearFilters?: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) rootRef.current?.querySelector<HTMLButtonElement>(':scope > button')?.focus();
  }, []);

  // A click (or tap) outside closes it. Focus goes back to the button, unless the
  // click put it somewhere else (e.g. in the search box).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      close(false);
      setTimeout(() => {
        if (document.activeElement === document.body || !document.activeElement) rootRef.current?.querySelector<HTMLButtonElement>(':scope > button')?.focus();
      });
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  // Focus the first field when it opens.
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('select, input, button')?.focus();
  }, [open]);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    close(true);
  }

  // Tabbing out of the popover closes it.
  function handleBlur(e: FocusEvent) {
    if (open && e.relatedTarget && !rootRef.current?.contains(e.relatedTarget as Node)) close(false);
  }

  return (
    <div className={`filter-menu${open ? ' open' : ''}`} ref={rootRef} onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <Button
        variant="secondary"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        <Icon name="filter" size={18} />
        Filters{activeFilters > 0 && ` (${activeFilters})`}
      </Button>

      {open && (
        <div id={panelId} ref={panelRef} className="filter-panel" role="dialog" aria-label="Filters">
          {children}
          {onClearFilters && (
            <div className="filter-panel-actions">
              <Button variant="tertiary" size="sm" disabled={activeFilters === 0} onClick={onClearFilters}>
                Clear filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
