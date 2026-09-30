import { isPingResult, type PingResult, type PlatformId, platformForUrl } from '@/core/messaging';

/**
 * Read the active tab and derive what the popup should say about it.
 *
 * `browser` is injected rather than imported so tests can pass `fakeBrowser`. Every failure mode —
 * no active tab, a tab we may not read (`activeTab` not granted), a page with no content script, a
 * listener that answered with something unexpected — resolves to `unsupported`. A popup lives
 * ~100ms: it must never surface an exception, and it must never be the reason a user cannot turn
 * the extension off.
 */
type BrowserApi = typeof import('wxt/browser').browser;

/** What the popup's status line reports. Derived, never assigned directly. */
export type TabState =
  /** No content script answered. Either the wrong site, or a page that predates the install. */
  | { readonly kind: 'unsupported' }
  /** A content script answered but the engine is not running: the extension is switched off. */
  | { readonly kind: 'inactive'; readonly platform: PlatformId }
  /** The extension is live on this tab. */
  | { readonly kind: 'active'; readonly platform: PlatformId; readonly columnOpen: boolean }
  /** Supported site, enabled, but the content script is not in this tab — a reload will fix it. */
  | { readonly kind: 'needs-reload'; readonly platform: PlatformId };

/**
 * Combine the two independent signals.
 *
 * `ping` alone cannot tell "wrong website" from "extension installed after this page loaded", and
 * that distinction decides whether the popup offers a Reload button. The tab URL settles it:
 * a supported host with no listener is a stale tab, anything else genuinely has nothing to do with
 * the extension. Collapsing the two inside `PingResult` keeps a single honest liveness signal on
 * the wire while the popup still gets the nuance it needs.
 */
export function deriveTabState(ping: PingResult, url: string | null, enabled: boolean): TabState {
  if (ping.kind === 'ready') {
    return enabled
      ? { kind: 'active', platform: ping.platform, columnOpen: ping.columnOpen }
      : { kind: 'inactive', platform: ping.platform };
  }
  // A supported host with no listener. With the extension on, the engine should be running, so the
  // tab predates the install or a previous disable; either way only a reload can change that. With
  // it off, nothing is wrong — the engine deliberately never started.
  const platform = url === null ? null : platformForUrl(url);
  if (platform === null) return { kind: 'unsupported' };
  return enabled ? { kind: 'needs-reload', platform } : { kind: 'inactive', platform };
}

/** The URL of the active tab, or null when it cannot be read. */
export async function activeTabUrl(browser: BrowserApi): Promise<string | null> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab?.url ?? null;
  } catch {
    return null;
  }
}

/** Ask the active tab what side-view is doing there. Never throws. */
async function pingActiveTab(browser: BrowserApi): Promise<PingResult> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return { kind: 'unsupported' };
    const response: unknown = await browser.tabs.sendMessage(tab.id, { type: 'sv:ping' });
    return isPingResult(response) ? response : { kind: 'unsupported' };
  } catch {
    // Rejects when nothing is listening: wrong site, or a page loaded before the install.
    return { kind: 'unsupported' };
  }
}

/** One round trip for both signals — the popup is too short-lived to make two. */
export async function readTabState(browser: BrowserApi, enabled: boolean): Promise<TabState> {
  const [ping, url] = await Promise.all([pingActiveTab(browser), activeTabUrl(browser)]);
  return deriveTabState(ping, url, enabled);
}
