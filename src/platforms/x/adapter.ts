import type { DetailIntent, IntentKind, LayoutMode, PlatformAdapter } from '@/core/types';
import { findXDetailHeader } from '@/platforms/detail-headers';
import { buildDetailFrameCss } from './detail-frame-css';
import { buildLayoutCss } from './layout-css';
import {
  resolveSelectors,
  X_DEFAULT_SELECTORS,
  X_INTERACTIVE_WITHIN_TWEET,
  type XSelectorKey,
} from './selectors';

/** Path segments that look like a profile but are app routes, not handles. */
const RESERVED_HANDLES = new Set([
  'home',
  'explore',
  'notifications',
  'messages',
  'settings',
  'compose',
  'search',
  'hashtag',
  'i',
  'intent',
  'about',
  'tos',
  'privacy',
  'login',
  'logout',
  'signup',
]);

const HOST_RE = /(^|\.)(x|twitter)\.com$/i;
const STATUS_RE = /^\/([A-Za-z0-9_]{1,15}|i)\/status\/(\d+)\/?$/;
/** A status href that may carry a sub-route, as a quote card's media thumbnail does. */
const QUOTED_STATUS_RE = /^\/([A-Za-z0-9_]{1,15}|i)\/status\/(\d+)(?:\/|$)/;
const HANDLE_RE = /^\/([A-Za-z0-9_]{1,15})\/?$/;

/** x.com / twitter.com adapter. Holds ALL platform-specific DOM knowledge. */
export class XAdapter implements PlatformAdapter {
  readonly id = 'x' as const;
  readonly columnPosition = 'inline' as const;
  readonly detailFrameName = 'sideview-detail';
  detailFrameUrl(url: string): string {
    // X's logged-in SW serves cached HTML (including X-Frame-Options: deny), outside DNR.
    // Its navigation handler explicitly skips URLs with `lang`, allowing the sub_frame
    // response-header rules to run. Preserve the page language and any explicit URL language.
    const frameUrl = new URL(url);
    if (!frameUrl.searchParams.has('lang')) {
      frameUrl.searchParams.set('lang', document.documentElement.lang || 'en');
    }
    return frameUrl.href;
  }
  private readonly s: Record<XSelectorKey, string>;

  constructor(overrides: Readonly<Record<string, string>> = {}) {
    this.s = resolveSelectors(overrides);
  }

  /** Our column mounts as the sibling immediately after the timeline column. */
  get columnAnchor(): { selector: string; append: 'after' } {
    return { selector: this.s.primaryColumn, append: 'after' };
  }

  matches(url: URL): boolean {
    return HOST_RE.test(url.hostname);
  }

  getPrimaryColumn(): HTMLElement | null {
    return (
      [...document.querySelectorAll<HTMLElement>(this.s.primaryColumn)].find(
        (element) => element.checkVisibility?.() !== false,
      ) ?? null
    );
  }

  getSidebarColumn(): HTMLElement | null {
    return document.querySelector<HTMLElement>(this.s.sidebarColumn);
  }

  layoutCss(mode: LayoutMode): string {
    return buildLayoutCss(mode, this.s);
  }

  detailHeader(doc: Document): HTMLElement | null {
    return findXDetailHeader(doc);
  }

  detailFrameCss(): string {
    return buildDetailFrameCss(this.s);
  }

  runSelfCheck(): Record<string, boolean> {
    const report: Record<string, boolean> = {};
    for (const key of Object.keys(X_DEFAULT_SELECTORS) as XSelectorKey[]) {
      try {
        report[key] = document.querySelector(this.s[key]) !== null;
      } catch {
        report[key] = false; // a malformed override selector must not abort startup
      }
    }
    return report;
  }

  resolveIntent(event: MouseEvent): DetailIntent | null {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    try {
      return this.classify(target);
    } catch {
      // A malformed selector override (e.g. one synced from another device before the options
      // page validated it) must never throw inside the capture-phase handler and swallow the
      // click — degrade to "not ours" and let X navigate natively.
      return null;
    }
  }

  private classify(target: Element): DetailIntent | null {
    const primary = this.getPrimaryColumn();
    if (!primary?.contains(target)) return null;
    if (target.closest('[role="dialog"],[aria-modal="true"],nav,[role="tablist"]')) return null;
    const destination = target.closest<HTMLAnchorElement>('a[href]');
    if (
      destination?.hasAttribute('download') ||
      (destination?.target && destination.target !== '_self')
    )
      return null;

    // 1. Media / action controls keep their native behaviour (lightbox, like, menu, ...).
    if (target.closest(X_INTERACTIVE_WITHIN_TWEET)) return null;

    // 2. Anchors we recognise, most specific first.
    const hashtag = target.closest<HTMLAnchorElement>(this.s.hashtag);
    if (hashtag) return this.hrefIntent('hashtag', hashtag.href);

    const search = target.closest<HTMLAnchorElement>(this.s.search);
    if (search) return this.searchIntent(search.href);

    const permalink = target.closest<HTMLAnchorElement>(this.s.permalink);
    if (permalink) return this.statusIntent(permalink.href);

    const avatar = target.closest<HTMLElement>(this.s.avatar);
    if (avatar) {
      const handle = avatar.getAttribute('data-testid')?.replace('UserAvatar-Container-', '');
      if (handle) return this.profileIntent(handle);
    }

    const anchor = target.closest<HTMLAnchorElement>('a[href]');
    if (anchor) return this.profileFromAnchor(anchor); // profile or null (external/other)

    // 3. Plain click on the tweet body → open the tweet's own status. A QUOTED tweet is its own
    //    `nestedQuotePreview` card; a click inside it targets the QUOTED tweet, never the
    //    enclosing one. X renders that card with no permalink of its own — the quoted handle and
    //    `<time>` are plain text — so the quoted status is recovered from the card's media
    //    thumbnail (`/handle/status/<id>/photo/1`) when it has one. When the quote has no media
    //    there is nothing to read and we return null: falling through to the enclosing permalink
    //    would open the quoting tweet, which is not what was clicked.
    const article = target.closest<HTMLElement>(this.s.tweet);
    if (!article) return null;

    const quote = target.closest<HTMLElement>(this.s.quote);
    if (quote && article.contains(quote)) return this.quotedStatusIntent(quote);

    const articlePerma = article.querySelector<HTMLAnchorElement>(this.s.permalink);
    if (articlePerma) return this.statusIntent(articlePerma.href);
    return null;
  }

  /**
   * The status a quote card points at, or null when the card exposes no status link. X's quote
   * card deliberately carries no permalink anchor, so the only source is the media thumbnail,
   * whose href is a sub-route of the quoted status. Normalising it back to the bare permalink is
   * what makes the sidebar open the quoted tweet instead of handing the click back to X.
   */
  private quotedStatusIntent(quote: Element): DetailIntent | null {
    for (const anchor of quote.querySelectorAll<HTMLAnchorElement>(this.s.permalink)) {
      const url = this.sameOriginUrl(anchor.href);
      const match = url?.pathname.match(QUOTED_STATUS_RE);
      const handle = match?.[1];
      const statusId = match?.[2];
      if (url && handle && statusId) {
        return {
          kind: 'status',
          url: `${url.origin}/${handle}/status/${statusId}`,
          meta: { handle, statusId },
        };
      }
    }
    return null;
  }

  /**
   * Resolve `href` against the page and admit it ONLY if it is a same-origin https(:) URL. The
   * detail intent's `url` is assigned to `iframe.src`, so this is the single choke point that keeps
   * an attacker-controlled or non-http(s) href (e.g. a `javascript:`/`data:` anchor, or a
   * cross-origin absolute href matched by a `*="/status/"` contains selector) off the frame sink.
   */
  private sameOriginUrl(href: string): URL | null {
    let url: URL;
    try {
      url = new URL(href, location.origin);
    } catch {
      return null;
    }
    if (url.origin !== location.origin || url.protocol !== 'https:') return null;
    return url;
  }

  private statusIntent(href: string): DetailIntent | null {
    const url = this.sameOriginUrl(href);
    if (!url) return null;
    const m = url.pathname.match(STATUS_RE);
    const handle = m?.[1];
    const statusId = m?.[2];
    if (!handle || !statusId) return null;
    return {
      kind: 'status',
      url: `${location.origin}/${handle}/status/${statusId}`,
      meta: { handle, statusId },
    };
  }

  private profileIntent(handle: string): DetailIntent {
    return { kind: 'profile', url: `${location.origin}/${handle}`, meta: { handle } };
  }

  private profileFromAnchor(anchor: HTMLAnchorElement): DetailIntent | null {
    const url = this.sameOriginUrl(anchor.href);
    if (!url) return null;
    const handle = url.pathname.match(HANDLE_RE)?.[1];
    if (!handle || RESERVED_HANDLES.has(handle.toLowerCase())) return null;
    return this.profileIntent(handle);
  }

  private searchIntent(href: string): DetailIntent | null {
    const url = this.sameOriginUrl(href);
    if (!url) return null;
    return {
      kind: 'search',
      url: url.href,
      meta: { query: url.searchParams.get('q') ?? undefined },
    };
  }

  private hrefIntent(kind: IntentKind, href: string): DetailIntent | null {
    const url = this.sameOriginUrl(href);
    return url && { kind, url: url.href };
  }
}
