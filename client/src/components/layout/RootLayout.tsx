// Outermost layout: the development panel (dev builds only) above every page.

import { Outlet } from 'react-router-dom';
import { DevPanel } from '../DevPanel';

export function RootLayout() {
  return (
    <>
      {import.meta.env.DEV && <DevPanel />}
      <Outlet />
    </>
  );
}
