// Thin notice at the very top of every page (auth and app layout alike).
// Its height is --banner-height in index.css: the sticky and fixed parts of the
// layouts (top bar, sidebar, mobile menu, toasts) sit right under it.

import { DEMO_NOTICE } from '../../utils/demo';

export function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      {DEMO_NOTICE}
    </div>
  );
}
