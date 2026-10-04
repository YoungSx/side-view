import { browser } from '#imports';

/**
 * The extension's popup <-> content-script contract.
 *
 * Platform-agnostic and dependency-free, exactly like `core/types.ts`: neither the popup nor the
 * content scripts import each other, they only agree on these shapes. The popup asks a tab what it
 * is; the content script answers from the state it already owns. Nothing here mutates anything —
 * every setting change is a direct `settings.*.setValue()` from the popup, which the running
 * engine already watches (`core/engine.ts`).
 *
 * There is deliberately no `openCurrent` / `closeColumn` command. The trigger path is a click on
 * the timeline, and closing the column already has a native button injected into the column
 * header (`providers/iframe/detail-actions.ts`).
 */

/** The platforms side-view can be active on. Mirrors `PlatformAdapter['id']`. */
export type PlatformId = 'x' | 'bluesky' | 'threads' | 'xiaohongshu';

/**
 * The answer to "what is side-view doing on this tab?".
 *
 * `unsupported` is deliberately overloaded: it covers both "this site has nothing to do with
 * side-view" and "the content script is not in this tab" (page predates the install, or the
 * engine bailed before installing its listener). The popup resolves the two apart by ALSO reading
 * `tab.url` and asking `isSupportedHost()` — an unsupported host needs no reload, a supported one
 * does. Collapsing them here keeps a single, honest liveness signal.
 */
export type PingResult =
  | { readonly kind: 'unsupported' }
  | {
      readonly kind: 'ready';
      readonly platform: PlatformId;
      /** Whether a detail view is currently mounted and visible in the column. */
      readonly columnOpen: boolean;
      readonly compactNavigationAvailable?: boolean;
    };

/** The only message the popup sends. */
export type PopupCommand = { readonly type: 'sv:ping' };

/** Narrow `sendMessage` to this contract so neither side can drift without a type error. */
export function isPopupCommand(value: unknown): value is PopupCommand {
  return (
    typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'sv:ping'
  );
}

/**
 * Structural check for a `PingResult` coming back over the wire. The popup cannot trust
 * `sendMessage` to have been answered by our own listener, so anything unrecognised degrades to
 * `unsupported` rather than rendering a half-valid status.
 */
export function isPingResult(value: unknown): value is PingResult {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as {
    kind?: unknown;
    platform?: unknown;
    columnOpen?: unknown;
    compactNavigationAvailable?: unknown;
  };
  if (record.kind === 'unsupported') return true;
  return (
    record.kind === 'ready' &&
    (record.platform === 'x' ||
      record.platform === 'bluesky' ||
      record.platform === 'threads' ||
      record.platform === 'xiaohongshu') &&
    typeof record.columnOpen === 'boolean' &&
    (record.compactNavigationAvailable === undefined ||
      typeof record.compactNavigationAvailable === 'boolean')
  );
}

/** The platform a URL belongs to, or null when side-view has no business on that site. */
export function platformForUrl(url: string): PlatformId | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const { protocol, hostname } = parsed;
  if (protocol !== 'https:' && protocol !== 'http:') return null;
  if (protocol === 'https:' && hostname === 'www.xiaohongshu.com') return 'xiaohongshu';
  if (/(^|\.)(x|twitter)\.com$/i.test(hostname)) return 'x';
  if (/^bsky\.app$/i.test(hostname)) return 'bluesky';
  if (/(^|\.)threads\.(com|net)$/i.test(hostname)) return 'threads';
  return null;
}

/**
 * Whether this URL is a site side-view has any business on. Derived from the same host list the
 * manifest declares, so the popup can tell "wrong site" from "needs a reload" without duplicating
 * per-adapter `matches()` logic (which the adapters keep private for their own purposes).
 */
export function isSupportedHost(url: string): boolean {
  return platformForUrl(url) !== null;
}

/**
 * Register the ping listener for the lifetime of the calling content script.
 *
 * `respond` supplies the state the content script already owns. Returning `undefined` from the
 * listener for anything that is not our command leaves the message for other receivers, so a page
 * hosting more than one of our content scripts cannot produce a double answer.
 */
export function servePing(
  respond: () => PingResult,
  onInvalidated: (cleanup: () => void) => void,
): void {
  const listener = (
    message: unknown,
    _sender: unknown,
    sendResponse: (response: unknown) => void,
  ): void => {
    if (!isPopupCommand(message)) return;
    sendResponse(respond());
  };
  browser.runtime.onMessage.addListener(listener);
  onInvalidated(() => browser.runtime.onMessage.removeListener(listener));
}
