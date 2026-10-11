// Loads one page of an appointment list for the search, filters and page in
// the URL. Shared by the doctor's and the admin's Appointments pages; they
// pass their own endpoint (getDoctorAppointments / getAllAppointments).

import { useEffect, useState } from 'react';
import { getErrorMessage } from '../api/client';
import type { Appointment, AppointmentQuery, Page } from '../types';
import { plural } from '../utils/text';
import { toAppointmentQuery, useAppointmentFilters } from './useAppointmentFilters';

// Must be a stable function (a module-level API function), not an inline arrow.
type FetchPage = (query: AppointmentQuery) => Promise<Page<Appointment>>;

export function useAppointmentList(fetchPage: FetchPage) {
  const { filters, update, clear, isFiltered } = useAppointmentFilters();
  const [reloadKey, setReloadKey] = useState(0);
  // The result remembers which request it belongs to; while that differs from
  // the current request, a newer page is on its way (the old one stays visible, dimmed).
  const listKey = `${JSON.stringify(toAppointmentQuery(filters))}|${reloadKey}`;
  const [list, setList] = useState<{ key: string; page: Page<Appointment> } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  // The default view (active, from today on) can be empty while past or cancelled
  // appointments exist, so an empty default view asks once more without any filter.
  const [nothingAtAll, setNothingAtAll] = useState<{ key: string; value: boolean } | null>(null);

  useEffect(() => {
    let ignore = false;
    fetchPage(toAppointmentQuery(filters))
      .then((result) => {
        if (ignore) return;
        // e.g. after a cancel emptied the last page, or an old link: go to the last page that exists
        const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (filters.page > lastPage) update({ page: lastPage }, { replace: true });
        else setList({ key: listKey, page: result });
        if (result.total === 0 && !isFiltered) {
          fetchPage({ pageSize: 1 })
            .then((all) => !ignore && setNothingAtAll({ key: listKey, value: all.total === 0 }))
            .catch(() => {}); // unknown: the search and filters stay
        }
      })
      .catch((err) => !ignore && setError({ key: listKey, message: getErrorMessage(err) }));
    return () => {
      ignore = true;
    };
  }, [fetchPage, filters, update, listKey, isFiltered]);

  // "32 appointments from today on" / "3 appointments match these filters", for the
  // toolbar. Empty while loading or when the list is empty (its EmptyState says it).
  const page = list?.page ?? null;
  const summary =
    page && page.items.length > 0 ? `${plural(page.total, 'appointment')}${isFiltered ? ` ${page.total === 1 ? 'matches' : 'match'} these filters` : ' from today on'}` : '';

  return {
    filters,
    update,
    clear,
    isFiltered,
    page,
    summary,
    isEmpty: nothingAtAll?.key === listKey && nothingAtAll.value, // no appointments at all: no search or filters to show
    busy: list?.key !== listKey,
    error: error?.key === listKey ? error.message : '', // only the current request's error
    reload: () => setReloadKey((k) => k + 1),
  };
}
