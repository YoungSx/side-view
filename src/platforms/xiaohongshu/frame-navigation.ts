import { isProfileUrl } from './urls';

/** Keep the site's default _blank author links inside an existing detail reading. */
export function installFrameNavigation(
  doc: Document,
  navigate = (url: string) => doc.defaultView?.location.assign(url),
): () => void {
  const view = doc.defaultView;
  if (!view) return () => {};
  if (isProfileUrl(new URL(doc.URL)))
    doc.documentElement.setAttribute('data-sv-xhs-profile-reading', '');
  const click = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const target = event.target as Element | null;
    const link = target?.closest<HTMLAnchorElement>('a[href]');
    if (
      !link ||
      link.hasAttribute('download') ||
      link.closest('[data-sv-detail-actions]') ||
      (link.target && link.target !== '_blank' && link.target !== '_self')
    )
      return;
    if (view.getSelection()?.toString().trim()) return;
    const url = new URL(link.href, doc.URL);
    if (!isProfileUrl(url) || url.origin !== view.location.origin) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    navigate(url.href);
  };
  doc.addEventListener('click', click, true);
  return () => {
    doc.removeEventListener('click', click, true);
    doc.documentElement.removeAttribute('data-sv-xhs-profile-reading');
  };
}
