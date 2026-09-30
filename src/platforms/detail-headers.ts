/** Native header discovery belongs to each platform; rendering/lifecycle remains shared. */
export function findXDetailHeader(doc: Document): HTMLElement | null {
  const back = doc.querySelector<HTMLElement>(
    '[data-testid="primaryColumn"] [data-testid="app-bar-back"]',
  );
  const row = back?.parentElement?.parentElement;
  return row && doc.defaultView?.getComputedStyle(row).flexDirection === 'row' ? row : null;
}
export function findBlueskyDetailHeader(doc: Document): HTMLElement | null {
  const main = doc.querySelector('main[role="main"]');
  if (!main || !doc.defaultView) return null;
  // Cheap structural filters first; getComputedStyle (a forced style flush) runs only on the few
  // candidate rows that survive them, not on every <div> in the thread.
  for (const row of main.querySelectorAll<HTMLElement>('div')) {
    if (!row.querySelector('button, [role="button"]')) continue;
    if (row.closest('[data-testid^="postThreadItem"], [data-testid^="feedItem"]')) continue;
    const style = doc.defaultView.getComputedStyle(row);
    if (style.position !== 'sticky' || style.flexDirection !== 'row') continue;
    const height = Number.parseFloat(style.minHeight);
    if (height >= 48 && height <= 80) return row;
  }
  return null;
}
