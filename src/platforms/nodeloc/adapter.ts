import { SV_ACTIVE_CLASS, SV_HOST_ATTR, SV_MIN_VIEWPORT_PX } from '@/core/style-ids';
import type { DetailIntent, LayoutMode, PlatformAdapter } from '@/core/types';
import { isNodelocUrl, parseTopicUrl } from './urls';

const ROW = 'tr.topic-list-item, .topic-list-item';
const INTERACTIVE =
  'button, [role="button"], input, textarea, select, video, [contenteditable="true"], .btn';

/**
 * Fixed column over the forum's own right rails (recent posts / ads). The theme declares its
 * `#main-outlet-wrapper` grid template with `!important` inside cascade layers, so reserving
 * viewport space like Xiaohongshu cannot win the cascade; covering the rails and hiding them
 * does, without moving the centered topic list at all.
 */
export class NodelocAdapter implements PlatformAdapter {
  readonly id = 'nodeloc' as const;
  readonly columnPosition = 'fixed' as const;
  readonly detailFrameName = 'sideview-nodeloc-detail';
  readonly columnAnchor = { selector: '#main', append: 'after' as const };

  matches(url: URL): boolean {
    return isNodelocUrl(url);
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
    return document.querySelector<HTMLElement>('.meta-recent-posts, .sidebar-ads-wrapper');
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
    // The clicked link wins (title, full-row overlays in card/expanded layouts, deep post links);
    // a linkless spot falls back to the row's own topic so the whole item is clickable in the
    // compact layout, which draws no overlay. Native compact rows navigate nowhere on such clicks.
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

  layoutCss(_mode: LayoutMode): string {
    return `
      @media (min-width: ${SV_MIN_VIEWPORT_PX}px) {
        body.${SV_ACTIVE_CLASS} .meta-recent-posts,
        body.${SV_ACTIVE_CLASS} .sidebar-ads-wrapper { display: none !important; }
      }
      @media (max-width: ${SV_MIN_VIEWPORT_PX - 1}px) {
        body.${SV_ACTIVE_CLASS} [${SV_HOST_ATTR}] { display: none !important; }
      }
    `;
  }

  detailFrameCss(): string {
    return `
      .d-header, .sidebar-wrapper, .meta-recent-posts, .sidebar-ads-wrapper,
      .floating-search-input-wrapper, .meta-sidebar-toggle { display: none !important; }
      #main-outlet-wrapper { grid-template-columns: minmax(0, 1fr) !important; padding: 0 !important; }
      #main-outlet { width: 100% !important; max-width: 100% !important; }
      .container, .wrap { padding-left: 8px !important; padding-right: 8px !important; }
    `;
  }

  detailHeader(doc: Document): HTMLElement | null {
    // The nested view's header row owns the title; the plain Discourse title is the fallback.
    return (
      doc.querySelector<HTMLElement>('.nested-view__header') ??
      doc.querySelector<HTMLElement>('#main-outlet .fancy-title')
    );
  }

  runSelfCheck(): Record<string, boolean> {
    return {
      main: !!document.querySelector('#main'),
      list: !!this.getPrimaryColumn(),
      topicLink: !!document.querySelector(`.topic-list ${ROW} a[href*="/t/"]`),
    };
  }
}
