/** Replication of Threads' native column *box* only.
 *
 * Nothing here reuses Threads' logic. It measures a real column on the live page and
 * emits the outer box that makes a replica indistinguishable from it. Everything
 * inside the box — header, radius, padding, typography, the scroller itself — is
 * rendered by Threads' own `BarcelonaRoutedColumn.react` and is deliberately not
 * replicated here. See `native-runtime.ts` for the reuse boundary.
 *
 * Selector rule inherited from `src/platforms/x/selectors.ts`: attribute and role
 * selectors only, never the hashed `x…` atomic classes, which churn on redesign.
 */

export const PANEL_ATTR = 'data-sideview-threads-panel';
const DECK = '[data-deck-column]';
const PAGE = '#barcelona-page-layout';

export interface ColumnBox {
  /** Visible width of the column being replicated. */
  width: number;
  /** Column height. Native columns are viewport-tall and scroll inside themselves. */
  height: number;
  /** Gap Threads' own layout leaves between two columns. */
  gap: number;
}

/** Threads' inter-column gap, observed on a two-column home timeline (2026-10-02).
 * Refreshed from a live native column whenever the page has one; this is only the
 * fallback for profile and search routes, which mount no column to measure. */
const COLUMN_GAP_PX = 12;

/** Measure the column this replica must match. Returns null when nothing is measurable. */
export function measureColumnBox(source: HTMLElement): ColumnBox | null {
  // A native column is ground truth for width, height and inter-column gap, including
  // Threads' responsive shrinking (640px with two columns, down to 420px with four).
  const deck = [...document.querySelectorAll<HTMLElement>(DECK)].find((c) => c.checkVisibility());
  if (deck) {
    const rect = deck.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const gap = Number.parseFloat(getComputedStyle(deck).marginRight);
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        gap: Number.isFinite(gap) ? gap : COLUMN_GAP_PX,
      };
    }
  }
  // Profile and search routes mount no native column. Take the width from the timeline
  // we sit beside, but keep the native column model: viewport-tall, scrolling inside.
  // Growing with content instead would leave the two columns on different scroll models.
  const rect = source.getBoundingClientRect();
  if (rect.width <= 0) return null;
  return {
    width: Math.round(rect.width),
    height: document.documentElement.clientHeight,
    gap: COLUMN_GAP_PX,
  };
}

/** The replica's outer box. It must never scroll: the inner column owns that. */
export function hostBoxCss(box: ColumnBox): string {
  return [
    // A grid track sized minmax(0, 1fr) is what lets the site-rendered column shrink to
    // this box. As a flex container the child would keep its `min-height: auto` floor,
    // grow past the box and get clipped instead of scrolling. This constrains it without
    // writing any style onto Threads' own element.
    'display:grid',
    'grid-template-rows:minmax(0,1fr)',
    `width:${box.width}px`,
    `height:${box.height}px`,
    // The gap belongs to the left column in Threads' own layout. Carrying it on our own
    // leading edge reproduces the same seam without writing margin onto the site's column.
    `margin-inline-start:${box.gap}px`,
    'overflow:hidden',
    'box-sizing:border-box',
  ].join(';');
}

/** Where a replica column belongs: Threads' own flex row, beside the real columns. */
export function columnAnchor(source: HTMLElement): HTMLElement | null {
  const page = source.closest<HTMLElement>(PAGE);
  return page?.checkVisibility() ? page : null;
}

export function insertColumn(host: HTMLElement, page: HTMLElement): void {
  page.lastElementChild?.after(host);
}
