// Loads one page of the patient's upcoming or past appointments. The page is
// kept in the URL (?upcomingPage=2&pastPage=3), one param per list, so a
// refresh or the Back button shows the same pages. Works like useAppointmentList.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getMyAppointments } from '../api/appointments';
import { getErrorMessage } from '../api/client';
import type { Appointment, MyAppointmentsView, Page } from '../types';

export function useMyAppointments(view: MyAppointmentsView) {
  const [params, setParams] = useSearchParams();
  const param = `${view}Page`;
  const requested = Number(params.get(param));
  const pageNumber = Number.isInteger(requested) && requested > 1 ? requested : 1;

  const setPage = useCallback(
    (page: number, options: { replace?: boolean } = {}) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (page > 1) next.set(param, String(page));
          else next.delete(param);
          return next;
        },
        { replace: options.replace },
      ),
    [setParams, param],
  );

  // setParams changes with every URL change, so paging one list would refetch the
  // other one too; the effect reads the latest setPage from a ref instead.
  const setPageRef = useRef(setPage);
  useEffect(() => {
    setPageRef.current = setPage;
  });

  const [reloadKey, setReloadKey] = useState(0);
  // The result remembers which request it belongs to; while that differs from
  // the current request, a newer page is on its way (the old one stays visible, dimmed).
  const listKey = `${pageNumber}|${reloadKey}`;
  const [list, setList] = useState<{ key: string; page: Page<Appointment> } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    let ignore = false;
    getMyAppointments(view, pageNumber)
      .then((result) => {
        if (ignore) return;
        // e.g. after a cancel emptied the last page, or an old link: go to the last page that exists
        const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (pageNumber > lastPage) setPageRef.current(lastPage, { replace: true });
        else setList({ key: listKey, page: result });
      })
      .catch((err) => !ignore && setError({ key: listKey, message: getErrorMessage(err) }));
    return () => {
      ignore = true;
    };
  }, [view, pageNumber, listKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return {
    page: list?.page ?? null,
    busy: list?.key !== listKey,
    error: error?.key === listKey ? error.message : '', // only the current request's error
    setPage,
    reload,
  };
}
