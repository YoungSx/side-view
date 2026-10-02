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
  /** Fixed height, or null when the column grows with its content and the page scrolls. */
  height: number | null;
  /** Trailing gap Threads' own layout leaves between columns. */
  gap: number;
}

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
        gap: Number.isFinite(gap) ? gap : 0,
      };
    }
  }
  // Profile and search routes mount no native column. Mirror the timeline we sit
  // beside: same width, and the same scroll model — those routes scroll as a document,
  // so the replica must grow with its content rather than clip it.
  const rect = source.getBoundingClientRect();
  if (rect.width <= 0) return null;
  const scrollsInternally = source.scrollHeight > source.clientHeight + 1;
  return {
    width: Math.round(rect.width),
    height: scrollsInternally ? Math.round(source.clientHeight) : null,
    gap: 0,
  };
}

/** The replica's outer box. It must never scroll: the inner column owns that. */
export function hostBoxCss(box: ColumnBox): string {
  return [
    'display:flex',
    'flex-direction:column',
    'flex:0 1 auto',
    `width:${box.width}px`,
    box.height === null ? 'height:auto' : `height:${box.height}px`,
    `margin-inline-end:${box.gap}px`,
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
