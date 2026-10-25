import { SV_ACTIVE_CLASS, SV_HOST_ATTR, SV_MIN_VIEWPORT_PX } from '@/core/style-ids';
import type { DetailIntent, LayoutMode, PlatformAdapter } from '@/core/types';
import { isLinuxdoUrl, parseTopicUrl } from './urls';

const ROW = 'tr.topic-list-item, .topic-list-item';
const INTERACTIVE =
  'button, [role="button"], input, textarea, select, video, [contenteditable="true"], .btn';

/**
 * Stock Discourse: the wrapper's grid template varies by breakpoint and sidebar state, so
 * `applyGridReservation` reserves the column as a `padding-right` on the wrapper instead of
 * rewriting the template — the flexible main track shrinks under it in every variant, and the
 * native sidebar rail stays untouched.
 */
export class LinuxdoAdapter implements PlatformAdapter {
  readonly id = 'linuxdo' as const;
  readonly columnPosition = 'split' as const;
  readonly detailFrameName = 'sideview-linuxdo-detail';
  readonly columnAnchor = { selector: '#main-outlet-wrapper', append: 'after' as const };
  // The docking geometry keeps the wrapper's right edge (and so the handle's drag plane) stable
  // while the reservation grows, so drag-to-resize behaves exactly as on nodeloc.
  readonly resizable = true;

  matches(url: URL): boolean {
    return isLinuxdoUrl(url);
  }

  detailFrameUrl(url: string): string {
    // Same-origin framing is allowed (`frame-ancestors 'self'`); keep deep post links intact.
    return url;
  }

  /** The outlet's content column while it hosts a visible topic list; the column starts at its right edge. */
  getPrimaryColumn(): HTMLElement | null {
    const outlet = document.querySelector<HTMLElement>('#main-outlet');
    if (!outlet || outlet.checkVisibility?.() === false) return null;
    return outlet.querySelector(`${ROW} a[href*="/t/"]`) ? outlet : null;
  }

  getSidebarColumn(): HTMLElement | null {
    // The native left sidebar is part of the retained page, not a replaced rail.
    return null;
  }

  resolveIntent(event: MouseEvent): DetailIntent | null {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    if (target.closest(INTERACTIVE)) return null;
    // User cards, modals and full-page search own their clicks; non-topic links inside a row
    // (categories, tags, authors) already fall through by URL shape.
    if (target.closest('[role="dialog"], .modal, .user-card, .group-card, .full-page-search'))
      return null;
    const row = target.closest<HTMLElement>(ROW);
    if (!row?.closest('.topic-list')) return null;
    // The clicked link wins (title, deep post links); a linkless spot falls back to the row's own
    // topic so the whole item is clickable. Pin toggles (href="") resolve to no topic and stay native.
    const link =
      target.closest<HTMLAnchorElement>('a[href]') ??
      row.querySelector<HTMLAnchorElement>('a.title, a.raw-topic-link');
    if (!link || link.hasAttribute('download')) return null;
    // Avatar and author links open the site's user card natively.
    if (link.hasAttribute('data-user-card')) return null;
    try {
      const url = new URL(link.getAttribute('href') ?? '', location.origin);
      if (!this.matches(url) || url.origin !== location.origin) return null;
      const topic = parseTopicUrl(url);
      if (!topic) return null;
      return { kind: 'status', url: url.href, meta: { statusId: topic.topicId } };
    } catch {
      return null;
    }
  }

  /**
   * The reservation rides on the wrapper's existing right padding (inline `!important`, the one
   * author declaration that outranks every stylesheet rule). `--sv-column-width` re-resolves live
   * during drags without touching anything else.
   */
  applyGridReservation(reserved: string | null): void {
    const wrapper = document.querySelector<HTMLElement>('#main-outlet-wrapper');
    if (!wrapper) return;
    if (reserved === null) {
      wrapper.style.removeProperty('padding-right');
      return;
    }
    wrapper.style.setProperty('padding-right', reserved, 'important');
  }

  /** The sticky global header keeps its strip: the column starts below it, dropdowns included. */
  columnTop(): number {
    return document.querySelector<HTMLElement>('.d-header')?.offsetHeight ?? 0;
  }

  /**
   * The wrapper is centered under a `max-width` on wide screens and never reaches the viewport's
   * right edge: the column docks to the wrapper's edge so it hugs the reflowed content instead of
   * floating over the page's dead margin.
   */
  columnRight(): number | null {
    const wrapper = document.querySelector<HTMLElement>('#main-outlet-wrapper');
    if (!wrapper) return null;
    const right = wrapper.getBoundingClientRect().right;
    return right > 0 ? right : null;
  }

  layoutCss(_mode: LayoutMode): string {
    // The native sidebar and the page content both stay; only narrow windows hide the column.
    return `
      @media (max-width: ${SV_MIN_VIEWPORT_PX - 1}px) {
        body.${SV_ACTIVE_CLASS} [${SV_HOST_ATTR}] { display: none !important; }
      }
    `;
  }

  detailFrameCss(): string {
    return `
      /* The post stream is virtualized: scroll deep (or open a deep post link) and the in-content
         title is reclaimed, with the title re-rendered inside the header's extra-info wrapper.
         Keep the header only in that state, trimmed to its title row, so the shared actions always
         have a visible home; at the top of the stream the header disappears entirely. */
      .d-header-wrap:not(:has(.extra-info-wrapper)) { display: none !important; }
      .d-header .contents > :not(.extra-info-wrapper) { display: none !important; }
      .sidebar-wrapper, .welcome-banner { display: none !important; }
      #main-outlet-wrapper { grid-template-columns: minmax(0, 1fr) !important; padding: 0 !important; }
      #main-outlet { width: 100% !important; max-width: 100% !important; }
      .container { padding-left: 8px !important; padding-right: 8px !important; }
      /* Give the title row a flex shape so the shared detail actions right-align at the panel
         edge instead of trailing the title text. */
      .title-wrapper { display: flex !important; flex-wrap: wrap !important; align-items: center !important; column-gap: 8px !important; }
    `;
  }

  detailHeader(doc: Document): HTMLElement | null {
    // The topic title row: in-content near the stream top, and in the header's extra-info
    // wrapper once the stream scrolls the in-content title away (the virtualized stream reclaims
    // it). The reconciler migrates the actions between the two as the reading scrolls.
    return (
      doc.querySelector<HTMLElement>('#main-outlet .title-wrapper') ??
      doc.querySelector<HTMLElement>('.d-header .title-wrapper') ??
      doc.querySelector<HTMLElement>('#main-outlet h1')
    );
  }

  runSelfCheck(): Record<string, boolean> {
    return {
      wrapper: !!document.querySelector('#main-outlet-wrapper'),
      list: !!this.getPrimaryColumn(),
      topicLink: !!document.querySelector(`.topic-list ${ROW} a[href*="/t/"]`),
    };
  }
}
