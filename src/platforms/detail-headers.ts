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
  for (const row of main.querySelectorAll<HTMLElement>('div')) {
    const style = doc.defaultView.getComputedStyle(row);
    if (style.position !== 'sticky' || style.flexDirection !== 'row') continue;
    const height = Number.parseFloat(style.minHeight);
    if (
      height >= 48 &&
      height <= 80 &&
      row.querySelector('button, [role="button"]') &&
      !row.closest('[data-testid^="postThreadItem"], [data-testid^="feedItem"]')
    )
      return row;
  }
  return null;
}
