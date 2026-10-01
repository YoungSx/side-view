import {
  SV_ACTIVE_CLASS,
  SV_COMPACT_NAV_CLASS,
  SV_HOST_ATTR,
  SV_MIN_VIEWPORT_PX,
} from '@/core/style-ids';
import type { DetailIntent, LayoutMode, PlatformAdapter } from '@/core/types';
import { findBlueskyDetailHeader } from '@/platforms/detail-headers';
import { resolveBlueskySelectors } from './selectors';

const INTERACTIVE =
  'button, [role="button"], [role="menuitem"], input, textarea, select, video, [contenteditable="true"]';

export class BlueskyAdapter implements PlatformAdapter {
  readonly id = 'bluesky' as const;
  readonly detailFrameName = 'sideview-bluesky-detail';
  readonly columnPosition = 'fixed' as const;
  private readonly s: ReturnType<typeof resolveBlueskySelectors>;

  constructor(overrides: Readonly<Record<string, string>> = {}) {
    this.s = resolveBlueskySelectors(overrides);
  }

  matches(url: URL): boolean {
    return url.protocol === 'https:' && url.hostname === 'bsky.app';
  }
  get columnAnchor() {
    return { selector: this.s.main, append: 'after' as const };
  }
  detailFrameUrl(url: string): string {
    return url;
  }

  getPrimaryColumn(): HTMLElement | null {
    const candidates = [...document.querySelectorAll<HTMLElement>(this.s.primaryColumn)].filter(
      (el) =>
        el.checkVisibility?.() !== false &&
        el.querySelector(`${this.s.post}, a[href^="/profile/"]`),
    );
    return candidates.find((el) => el.getBoundingClientRect().width > 0) ?? candidates[0] ?? null;
  }
  getSidebarColumn(): HTMLElement | null {
    return document.querySelector(this.s.sidebarColumn);
  }

  layoutCss(mode: LayoutMode): string {
    // Bluesky's center and native navigation are independently fixed/centered. Never reflow them.
    return `
      ${mode === 'replace-sidebar' ? `body.${SV_ACTIVE_CLASS} ${this.s.sidebarColumn} { visibility: hidden !important; }` : ''}
      @media (max-width: ${SV_MIN_VIEWPORT_PX - 1}px) {
        body.${SV_ACTIVE_CLASS} [${SV_HOST_ATTR}] { display: none !important; }
      }
    `;
  }
  compactNavigationCss(): string {
    const nav = `body.${SV_COMPACT_NAV_CLASS} ${this.s.navigation}:has(a[href="/notifications"])`;
    return `${nav} { width: 88px !important; padding: 12px !important; }
      ${nav} a [dir] { display: none !important; }
      ${nav} a { justify-content: center !important; }`;
  }
  detailHeader(doc: Document): HTMLElement | null {
    return findBlueskyDetailHeader(doc);
  }

  detailFrameCss(): string {
    return `${this.s.navigation}, ${this.s.sidebarColumn} { display: none !important; }
      html, body { min-width: 0 !important; }
      main #content > div, main [data-testid$="-flatlist"] > div {
        max-width: 100% !important; transform: none !important;
      }`;
  }
  runSelfCheck(): Record<string, boolean> {
    return Object.fromEntries(
      Object.entries(this.s).map(([key, selector]) => {
        try {
          return [key, !!document.querySelector(selector)];
        } catch {
          return [key, false];
        }
      }),
    );
  }

  resolveIntent(event: MouseEvent): DetailIntent | null {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    try {
      if (!document.querySelector(this.s.main)?.contains(target) || target.closest(INTERACTIVE))
        return null;
      if (target.closest('[role="dialog"],[aria-modal="true"],nav,[role="tablist"]')) return null;
      // Links (including external cards) own their own destination; never fall back to their post.
      const link = target.closest<HTMLAnchorElement>('a[href]');
      if (link) {
        if (link.hasAttribute('download') || (link.target && link.target !== '_self')) return null;
        return this.fromHref(link.getAttribute('href') ?? '');
      }
      const post = target.closest(this.s.post);
      if (!post) return null;
      const quoted = target.closest('[role="link"]');
      if (quoted && quoted !== post && post.contains(quoted)) {
        const perma = quoted.querySelector<HTMLAnchorElement>(this.s.permalink);
        return perma ? this.fromHref(perma.getAttribute('href') ?? '') : null;
      }
      const perma = post.querySelector<HTMLAnchorElement>(this.s.permalink);
      return perma ? this.fromHref(perma.getAttribute('href') ?? '') : null;
    } catch {
      return null;
    }
  }

  private fromHref(href: string): DetailIntent | null {
    const url = new URL(href, location.origin);
    if (!this.matches(url) || url.origin !== location.origin) return null;
    const status = url.pathname.match(/^\/profile\/([^/]+)\/post\/([a-zA-Z0-9]+)\/?$/);
    if (status?.[1] && status[2])
      return {
        kind: 'status',
        url: `${url.origin}${url.pathname.replace(/\/$/, '')}`,
        meta: { handle: decodeURIComponent(status[1]), statusId: status[2] },
      };
    const profile = url.pathname.match(/^\/profile\/([^/]+)\/?$/);
    if (profile?.[1])
      return {
        kind: 'profile',
        url: `${url.origin}${url.pathname}`,
        meta: { handle: decodeURIComponent(profile[1]) },
      };
    if (url.pathname === '/search')
      return {
        kind: 'search',
        url: url.href,
        meta: { query: url.searchParams.get('q') ?? undefined },
      };
    if (url.pathname.startsWith('/hashtag/')) return { kind: 'hashtag', url: url.href };
    return null;
  }
}
