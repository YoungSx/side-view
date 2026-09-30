import { i18n } from '#i18n';

const ACTIONS = 'data-sv-detail-actions';
const HEADER = 'data-sv-detail-header';
const STYLE = 'sv-detail-actions-style';
const css = `
[${HEADER}] { min-width:0!important; }
[${ACTIONS}] { display:flex!important; flex:0 0 auto!important; align-items:center!important; gap:2px!important; margin-left:auto!important; align-self:center!important; color:var(--sv-native-icon-color, inherit)!important; }
[${ACTIONS}] > :is(a,button) { all:unset; box-sizing:border-box; display:inline-flex; flex:0 0 var(--sv-native-button-width,36px); width:var(--sv-native-button-width,36px); height:var(--sv-native-button-height,36px); align-items:center; justify-content:center; border-radius:var(--sv-native-button-radius,999px); cursor:pointer; color:inherit; text-decoration:none; }
[${ACTIONS}] > :is(a,button):hover { background:rgba(128,128,128,.15); }
[${ACTIONS}] > :is(a,button):focus-visible { outline:2px solid currentColor; outline-offset:2px; }
[${ACTIONS}] svg { width:var(--sv-native-icon-size,20px);height:var(--sv-native-icon-size,20px);display:block;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round; }
`;
function icon(doc: Document, path: string): SVGElement {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', path);
  svg.append(p);
  return svg;
}
/** Add two flex items to the native header. No absolute overlay, title bar, or native-node moves. */
export function installDetailActions(
  doc: Document,
  findHeader: (doc: Document) => HTMLElement | null,
  options: { href: () => string; onClose: () => void },
): () => void {
  const group = doc.createElement('div');
  group.setAttribute(ACTIONS, '');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', i18n.t('detail.actionsLabel'));
  const open = doc.createElement('a');
  open.target = '_blank';
  open.rel = 'noopener noreferrer';
  open.title = i18n.t('common.openInNewTab');
  open.setAttribute('aria-label', open.title);
  open.href = options.href();
  open.append(
    icon(doc, 'M14 4h6v6 M20 4 10 14 M10 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-5'),
  );
  open.addEventListener('click', (event) => {
    event.stopPropagation();
    open.href = options.href();
  });
  const close = doc.createElement('button');
  close.type = 'button';
  close.title = i18n.t('common.close');
  close.setAttribute('aria-label', i18n.t('common.close'));
  close.append(icon(doc, 'M6 6l12 12 M18 6 6 18'));
  close.addEventListener('click', (event) => {
    event.stopPropagation();
    options.onClose();
  });
  group.append(open, close);
  const style = doc.createElement('style');
  style.id = STYLE;
  style.textContent = css;
  let header: HTMLElement | null = null;
  const reconcile = () => {
    const next = findHeader(doc);
    if (header !== next) {
      header?.removeAttribute(HEADER);
      group.remove();
      header = next;
    }
    if (!header) return;
    if (!style.isConnected) (doc.head ?? doc.documentElement).append(style);
    if (!header.hasAttribute(HEADER)) header.setAttribute(HEADER, '');
    // Match the native action nearest our group (Bluesky's preferences button), never our
    // own SVGs. X's header falls back to its back icon. Read the painted path, since platforms
    // differ between fill-based and stroke-based icon sets.
    const nativeIcons = [
      ...header.querySelectorAll<SVGElement>('button svg, [role="button"] svg'),
    ].filter((svg) => !group.contains(svg));
    const nativeIcon = nativeIcons.at(-1);
    const nativeButton = nativeIcon?.closest<HTMLElement>('button, [role="button"]');
    const nativeButtonStyle = nativeButton && doc.defaultView?.getComputedStyle(nativeButton);
    const setMetric = (name: string, value: string): void => {
      if (group.style.getPropertyValue(name) !== value) group.style.setProperty(name, value);
    };
    if (nativeButton) {
      const rect = nativeButton.getBoundingClientRect();
      if (rect.width >= 24 && rect.width <= 64)
        setMetric('--sv-native-button-width', `${rect.width}px`);
      if (rect.height >= 24 && rect.height <= 64)
        setMetric('--sv-native-button-height', `${rect.height}px`);
      if (nativeButtonStyle?.borderRadius)
        setMetric('--sv-native-button-radius', nativeButtonStyle.borderRadius);
    }
    const iconSize = nativeIcon?.getBoundingClientRect().width;
    if (iconSize && iconSize >= 16 && iconSize <= 32)
      setMetric('--sv-native-icon-size', `${iconSize}px`);
    const nativeStyle =
      nativeIcon &&
      doc.defaultView?.getComputedStyle(nativeIcon.querySelector('path') ?? nativeIcon);
    const painted = (value: string | undefined): value is string =>
      !!value && value !== 'none' && value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)';
    const color = painted(nativeStyle?.stroke)
      ? nativeStyle.stroke
      : painted(nativeStyle?.fill)
        ? nativeStyle.fill
        : nativeStyle?.color;
    if (color && group.style.getPropertyValue('--sv-native-icon-color') !== color) {
      group.style.setProperty('--sv-native-icon-color', color);
    }
    if (group.parentElement !== header || header.lastElementChild !== group) header.append(group);
  };
  // Bluesky mutates class/style on its subtree constantly; coalesce those bursts into one reconcile
  // per frame so the header scan doesn't run on every attribute tick. The FIRST reconcile below
  // stays synchronous so the actions mount immediately when the header already exists.
  // Call rAF as an unqualified global, not a detached reference: `const raf = requestAnimationFrame;
  // raf(cb)` loses the window receiver and throws "Illegal invocation" in real browsers. rAF is
  // absent under jsdom, so fall back to a macrotask there.
  const scheduleFrame =
    typeof requestAnimationFrame === 'function'
      ? (cb: () => void): void => void requestAnimationFrame(cb)
      : (cb: () => void): void => void setTimeout(cb, 0);
  let scheduled = false;
  let disposed = false;
  const scheduleReconcile = (): void => {
    if (scheduled || disposed) return;
    scheduled = true;
    scheduleFrame(() => {
      scheduled = false;
      if (!disposed) reconcile();
    });
  };
  const observer = new MutationObserver((records) => {
    if (records.some((record) => !group.contains(record.target) && record.target !== style))
      scheduleReconcile();
  });
  observer.observe(doc.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'fill', 'stroke', 'data-theme'],
  });
  const theme = doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  theme?.addEventListener?.('change', scheduleReconcile);
  reconcile();
  return () => {
    disposed = true;
    observer.disconnect();
    theme?.removeEventListener?.('change', scheduleReconcile);
    header?.removeAttribute(HEADER);
    group.remove();
    style.remove();
  };
}
