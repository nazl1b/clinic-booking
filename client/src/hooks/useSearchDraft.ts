// Text of a search box whose value is kept in the URL. It follows the URL when that
// changes from outside (Clear filters, Back button), and writes to the URL after a
// short pause while typing instead of on every key.
//
//   const [search, setSearch] = useSearchDraft(filters.search, commitSearch);
//   <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} … />

import { useEffect, useState } from 'react';

const SEARCH_DELAY_MS = 300;

// onCommit receives the typed text; it should update the URL with { replace: true },
// so typing does not add one history entry per search.
export function useSearchDraft(urlValue: string, onCommit: (value: string) => void) {
  const [search, setSearch] = useState(urlValue);

  // Follow the URL when it changes from outside.
  const [seenUrlValue, setSeenUrlValue] = useState(urlValue);
  if (urlValue !== seenUrlValue) {
    setSeenUrlValue(urlValue);
    setSearch(urlValue);
  }

  useEffect(() => {
    if (search.trim() === urlValue.trim()) return;
    const timer = setTimeout(() => onCommit(search), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, urlValue, onCommit]);

  return [search, setSearch] as const;
}
