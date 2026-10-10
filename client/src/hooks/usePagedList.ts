// One paged list whose search, filters and page are kept in the URL under the
// list's own names, e.g. ?doctorsSearch=maria&doctorsStatus=active&doctorsPage=2,
// so two lists on one page keep theirs apart, and a refresh, a shared link or the
// Back button shows the same list. Loads like useAppointmentList: the server
// searches, filters and pages; the old page stays visible (dimmed) while a newer
// one loads.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import type { Page } from '../types';

// Filter values as they are in the URL; '' = not set.
export type ListFilters<F extends string> = Record<F, string>;

// Both must be stable: a module-level array (`as const`) and a module-level function.
export function usePagedList<T, F extends string>(
  prefix: string, // e.g. "doctors"
  filterNames: readonly F[], // e.g. ['search', 'status'] → doctorsSearch, doctorsStatus
  fetchPage: (filters: ListFilters<F>, page: number) => Promise<Page<T>>,
) {
  const [params, setParams] = useSearchParams();
  const paramOf = useCallback((name: string) => `${prefix}${name[0].toUpperCase()}${name.slice(1)}`, [prefix]);
  const pageParam = `${prefix}Page`;

  const filtersKey = JSON.stringify(Object.fromEntries(filterNames.map((name) => [name, params.get(paramOf(name)) ?? ''])));
  // Same object while this list's params do not change, so it can be an effect dependency.
  const filters = useMemo(() => JSON.parse(filtersKey) as ListFilters<F>, [filtersKey]);
  const isFiltered = Object.values<string>(filters).some((value) => value !== '');
  const requested = Number(params.get(pageParam));
  const pageNumber = Number.isInteger(requested) && requested > 1 ? requested : 1;

  const setPage = useCallback(
    (page: number, options: { replace?: boolean } = {}) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (page > 1) next.set(pageParam, String(page));
          else next.delete(pageParam);
          return next;
        },
        { replace: options.replace },
      ),
    [setParams, pageParam],
  );

  // Any filter change goes back to page 1.
  const update = useCallback(
    (changes: Partial<ListFilters<F>>, options: { replace?: boolean } = {}) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [name, value] of Object.entries(changes) as [string, string | undefined][]) {
            const trimmed = value?.trim() ?? '';
            if (trimmed) next.set(paramOf(name), trimmed);
            else next.delete(paramOf(name));
          }
          next.delete(pageParam);
          return next;
        },
        { replace: options.replace },
      ),
    [setParams, paramOf, pageParam],
  );

  const clear = useCallback(
    () =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        for (const name of filterNames) next.delete(paramOf(name));
        next.delete(pageParam);
        return next;
      }),
    [setParams, filterNames, paramOf, pageParam],
  );

  // setParams changes with every URL change, so paging one list would refetch the
  // other one too; the effect reads the latest setPage from a ref instead.
  const setPageRef = useRef(setPage);
  useEffect(() => {
    setPageRef.current = setPage;
  });

  const [reloadKey, setReloadKey] = useState(0);
  // The result remembers which request it belongs to; while that differs from
  // the current request, a newer page is on its way.
  const listKey = `${filtersKey}|${pageNumber}|${reloadKey}`;
  const [list, setList] = useState<{ key: string; page: Page<T> } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    let ignore = false;
    fetchPage(filters, pageNumber)
      .then((result) => {
        if (ignore) return;
        // e.g. after an action emptied the last page, or an old link: go to the last page that exists
        const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (pageNumber > lastPage) setPageRef.current(lastPage, { replace: true });
        else setList({ key: listKey, page: result });
      })
      .catch((err) => !ignore && setError({ key: listKey, message: getErrorMessage(err) }));
    return () => {
      ignore = true;
    };
  }, [fetchPage, filters, pageNumber, listKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return {
    filters,
    update,
    clear,
    isFiltered,
    page: list?.page ?? null,
    busy: list?.key !== listKey,
    error: error?.key === listKey ? error.message : '', // only the current request's error
    setPage,
    reload,
  };
}
