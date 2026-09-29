import type { DetailIntent, IntentKind, LayoutMode, PlatformAdapter } from '@/core/types';
import { buildDetailFrameCss } from './detail-frame-css';
import { buildCompactNavigationCss, buildLayoutCss } from './layout-css';
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
const STATUS_RE = /^\/([^/]+)\/status\/(\d+)/;
const HANDLE_RE = /^\/([A-Za-z0-9_]{1,15})\/?$/;

/** x.com / twitter.com adapter. Holds ALL platform-specific DOM knowledge. */
export class XAdapter implements PlatformAdapter {
  readonly id = 'x' as const;
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
    return document.querySelector<HTMLElement>(this.s.primaryColumn);
  }

  getSidebarColumn(): HTMLElement | null {
    return document.querySelector<HTMLElement>(this.s.sidebarColumn);
  }

  layoutCss(mode: LayoutMode): string {
    return buildLayoutCss(mode, this.s);
  }

  compactNavigationCss(): string {
    return buildCompactNavigationCss(this.s);
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

    // 3. Plain click on the tweet body → open the tweet's own status. A QUOTED tweet renders as a
    //    role="link" block (NOT a nested <article>) carrying its own /status/ link; resolve to that
    //    so clicking a quote opens the quoted tweet, never the enclosing one.
    const article = target.closest<HTMLElement>(this.s.tweet);
    if (!article) return null;
    const articlePerma = article.querySelector<HTMLAnchorElement>(this.s.permalink);

    const quote = target.closest<HTMLElement>(this.s.quote);
    if (quote && article.contains(quote)) {
      const quotePerma = quote.querySelector<HTMLAnchorElement>(this.s.permalink);
      // A distinct status = a real quoted tweet. A matching href = a role="link" wrapper around the
      // whole tweet body, which shares the enclosing permalink → fall through to the tweet below.
      if (quotePerma && quotePerma.href !== articlePerma?.href) {
        return this.statusIntent(quotePerma.href);
      }
    }

    if (articlePerma) return this.statusIntent(articlePerma.href);
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
    if (!handle || !statusId) return { kind: 'status', url: url.href };
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
