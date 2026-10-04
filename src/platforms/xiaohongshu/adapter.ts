import { SV_ACTIVE_CLASS, SV_HOST_ATTR, SV_MIN_VIEWPORT_PX } from '@/core/style-ids';
import type { DetailIntent, LayoutMode, PlatformAdapter } from '@/core/types';
import { installFrameNavigation } from './frame-navigation';
import { XHS_LAYOUT_STATUS } from './protocol';
import { isProfileUrl } from './urls';

const CARD = 'section.note-item';
const FEED = '.feeds-container';
const INTERACTIVE =
  'button, [role="button"], input, textarea, select, video, [contenteditable="true"], .like-wrapper';

/** Uses the site's signed note links and native responsive detail renderer. */
export class XiaohongshuAdapter implements PlatformAdapter {
  readonly id = 'xiaohongshu' as const;
  readonly columnPosition = 'split' as const;
  readonly detailFrameName = 'sideview-xiaohongshu-detail';
  readonly columnAnchor = { selector: '#app', append: 'after' as const };

  matches(url: URL): boolean {
    return url.protocol === 'https:' && url.hostname === 'www.xiaohongshu.com';
  }

  detailFrameUrl(url: string): string {
    return url;
  }

  getPrimaryColumn(): HTMLElement | null {
    if (document.documentElement.getAttribute(XHS_LAYOUT_STATUS) !== 'available') return null;
    return (
      [...document.querySelectorAll<HTMLElement>(FEED)].find(
        (feed) => feed.checkVisibility?.() !== false && !!feed.querySelector(CARD),
      ) ?? null
    );
  }

  getSidebarColumn(): HTMLElement | null {
    return null;
  }

  observeLayoutAvailability(onUnavailable: () => void): () => void {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      if (root.getAttribute(XHS_LAYOUT_STATUS) !== 'available') onUnavailable();
    });
    observer.observe(root, { attributes: true, attributeFilter: [XHS_LAYOUT_STATUS] });
    return () => observer.disconnect();
  }

  resolveIntent(event: MouseEvent): DetailIntent | null {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    if (target.closest(INTERACTIVE)) return null;
    if (target.closest('.note-detail-mask, [role="dialog"], [aria-modal="true"]')) return null;
    const card = target.closest(CARD);
    if (!card?.closest(FEED)) return null;
    // Classify native author _blank links before applying the note-link target guard.
    const link = target.closest<HTMLAnchorElement>('a[href]');
    if (!link || link.hasAttribute('download')) return null;
    try {
      const url = new URL(link.getAttribute('href') ?? '', location.origin);
      if (!this.matches(url) || url.origin !== location.origin) return null;
      if (isProfileUrl(url)) {
        if (link.target && link.target !== '_self' && link.target !== '_blank') return null;
        return { kind: 'profile', url: url.href };
      }
      if (link.target && link.target !== '_self') return null;
      // Profile cards use /user/profile/:user/:note; native navigation opens /explore/:note.
      const profileNote = url.pathname.match(/^\/user\/profile\/[a-f\d]{24}\/([a-f\d]{24})\/?$/i);
      if (profileNote?.[1]) url.pathname = `/explore/${profileNote[1]}`;
      // Search uses /search_result/:id and keeps its own detail route.
      const note = url.pathname.match(/^\/(?:explore|search_result)\/([a-f\d]{24})\/?$/i);
      if (!note?.[1]) return null;
      // The hidden SEO permalink has no token and can lead to an unavailable-note page.
      if (!url.searchParams.get('xsec_token')) return null;
      // Feed cards can leave this empty; the native click handler fills it before navigation.
      // Loading that raw href directly can silently redirect the detail back to /explore.
      if (!url.searchParams.get('xsec_source')) {
        url.searchParams.set(
          'xsec_source',
          url.pathname.startsWith('/search_result/')
            ? 'pc_search'
            : location.pathname.startsWith('/user/profile/')
              ? 'pc_user'
              : 'pc_feed',
        );
      }
      return { kind: 'status', url: url.href, meta: { statusId: note[1] } };
    } catch {
      return null;
    }
  }

  layoutCss(_mode: LayoutMode): string {
    return `
      @media (min-width: ${SV_MIN_VIEWPORT_PX}px) {
        body.${SV_ACTIVE_CLASS} #app { width: calc(100% - var(--sv-column-width)) !important; }
        body.${SV_ACTIVE_CLASS} .feeds-container { width: 100% !important; }
        body.${SV_ACTIVE_CLASS} #global { min-width: 0 !important; width: 100% !important; }
      }
      @media (max-width: ${SV_MIN_VIEWPORT_PX - 1}px) {
        body.${SV_ACTIVE_CLASS} [${SV_HOST_ATTR}] { display: none !important; }
      }
    `;
  }

  detailFrameCss(): string {
    // Keep the site's narrow-screen media carousel, sticky author and comment composer intact.
    return `
      .side-bar, .top-bar, .header-dual { display: none !important; }
      html:not([data-sv-xhs-profile-reading]) :is(.close-circle, .note-detail-mask > .close-box) { display: none !important; }
      html, body, #app, #global, .main-container, .main-content, #mfContainer {
        min-width: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important;
      }
      .note-detail-mask { position: fixed !important; inset: 0 !important; background: var(--elevation-note-background, var(--elevation-surface)) !important; }
      #noteContainer { transform: none !important; margin: 0 !important; width: 100% !important; height: 100dvh !important; border-radius: 0 !important; }
      #noteContainer > .media-container { min-width: 0 !important; }
      #userPageContainer { min-width: 0 !important; width: 100% !important; margin: 0 !important; padding-top: 0 !important; }
      #userPageContainer .user-nickname { align-items: center !important; }
      #userPageContainer .user-name { min-width: 0 !important; overflow: hidden; text-overflow: ellipsis; }
    `;
  }

  installDetailFrame(doc: Document): () => void {
    return installFrameNavigation(doc);
  }

  detailHeader(doc: Document): HTMLElement | null {
    const headers = doc.querySelectorAll<HTMLElement>(
      '#noteContainer > .author > .author-wrapper, #noteContainer .author-container > .author-wrapper',
    );
    return (
      [...headers].find((header) => header.checkVisibility?.() !== false) ??
      doc.querySelector<HTMLElement>('#userPageContainer .user-nickname')
    );
  }

  runSelfCheck(): Record<string, boolean> {
    return {
      app: !!document.querySelector('#app'),
      feed: !!this.getPrimaryColumn(),
      note: !!document.querySelector(`${FEED} ${CARD} a.cover[href*="xsec_token="]`),
    };
  }
}
