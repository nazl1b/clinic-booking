// Search box, optional selects and "Clear filters" above a paged list (usePagedList),
// like AppointmentFilters above the appointment lists. The values live in the URL;
// typing in the search box updates the URL after a short pause (useSearchDraft).

import { useCallback, type ReactNode } from 'react';
import { useSearchDraft } from '../hooks/useSearchDraft';
import { Button } from './ui/Button';
import { SearchInput } from './ui/SearchInput';

interface ListToolbarProps {
  searchLabel: string; // for screen readers, e.g. "Search doctors"
  placeholder: string;
  search: string; // the search in the URL
  onChange: (changes: { search: string }, options: { replace?: boolean }) => void;
  isFiltered: boolean;
  onClear: () => void;
  children?: ReactNode; // selects, e.g. status
}

export function ListToolbar({ searchLabel, placeholder, search: urlSearch, onChange, isFiltered, onClear, children }: ListToolbarProps) {
  const commitSearch = useCallback((search: string) => onChange({ search }, { replace: true }), [onChange]);
  const [search, setSearch] = useSearchDraft(urlSearch, commitSearch);

  return (
    <div className="toolbar filters" role="search">
      <SearchInput label={searchLabel} className="filters-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder} />
      {children}
      {isFiltered && (
        <Button variant="tertiary" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
