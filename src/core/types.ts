/**
 * Platform-agnostic contracts for the side-view engine.
 *
 * The engine (`src/core`) depends ONLY on these interfaces. Everything platform-specific — x.com
 * selectors, iframe rendering, shadow-DOM layout — lives behind an implementation, so new
 * platforms (BlueSky/Threads), a future GraphQL renderer, or new layout modes slot in without
 * touching the interception logic.
 */

/** The kind of target a timeline click resolves to. */
export type IntentKind = 'status' | 'profile' | 'hashtag' | 'search';

/** A normalized, load-ready action derived from a click on a platform timeline. */
export interface DetailIntent {
  /** What the target represents; drives policy (which kinds we intercept) and rendering. */
  readonly kind: IntentKind;
  /** Absolute, same-origin URL ready to load in the detail column. */
  readonly url: string;
  /** Structured hints for non-iframe renderers (GraphQL/native) — optional. */
  readonly meta?: {
    readonly handle?: string;
    readonly statusId?: string;
    readonly query?: string;
  };
}

/** Where the detail column sits relative to the host layout. */
export type LayoutMode = 'replace-sidebar' | 'insert-column';

/** Lifecycle hooks the LayoutController invokes as its shadow host mounts/unmounts. */
export interface LayoutMountHooks {
  /** Called with the render container each time the shadow host (re)mounts. */
  onMount(container: HTMLElement): void;
  /** Called when the shadow host is removed (e.g. host-page re-render). */
  onRemove(): void;
}

/** Encapsulates ALL knowledge of a single platform's DOM and navigation. */
export interface PlatformAdapter {
  readonly id: 'x' | 'bluesky' | 'threads';
  /** Marker set as the detail iframe's `name` so the in-frame script recognises itself. */
  readonly detailFrameName: string;
  /** Where the detail column attaches: a STABLE CSS selector + which side of the anchor. */
  readonly columnAnchor: { readonly selector: string; readonly append: 'after' | 'before' };
  /** Does this adapter own the given location? */
  matches(url: URL): boolean;
  /** The persistent timeline column, or null if not present yet. */
  getPrimaryColumn(): HTMLElement | null;
  /** The native right column replaced in `replace-sidebar` mode, or null. */
  getSidebarColumn(): HTMLElement | null;
  /**
   * Classify a click into an intent, or null to let the platform handle it natively.
   * Pure: performs NO `preventDefault`/DOM mutation — the click-router owns policy + cancelation.
   */
  resolveIntent(event: MouseEvent): DetailIntent | null;
  /** Host-page CSS (attribute selectors + `!important`) for the given layout mode. */
  layoutCss(mode: LayoutMode): string;
  /** CSS injected INSIDE the detail frame to strip the platform's own chrome. */
  detailFrameCss(): string;
  /** Report which load-bearing selectors currently resolve — a DOM-drift canary. */
  runSelfCheck(): Record<string, boolean>;
}

/** Renders a `DetailIntent` into the column. Swappable: iframe today, GraphQL/native later. */
export interface DetailColumnProvider {
  /** Render the detail UI into `container` (inside the LayoutController's shadow root). */
  mount(container: HTMLElement): void;
  /** Open a fresh target (new thread) — loads/replaces the primary view. */
  open(intent: DetailIntent): void;
  /** Replace the current content in place (profile/search) without a full reset. */
  replaceContent(intent: DetailIntent): void;
  /** Release the render root but keep provider state (used across host re-mounts). */
  unmount(): void;
  /** Permanently tear down and release all resources. */
  destroy(): void;
}

/** Owns where/how the detail column sits in the host page. Layout concerns only. */
export interface LayoutController {
  /** Inject layout CSS and mount the shadow host for `mode`; idempotent. */
  attach(mode: LayoutMode, hooks: LayoutMountHooks): Promise<void>;
  /** Re-run the idempotent mount if the shadow host was detached by a host-page re-render. */
  reattachIfDetached(): void;
  /**
   * Whether the detail column is currently shown. False below the layout breakpoint, where the
   * column is hidden — the click-router consults this so it never cancels native navigation into
   * an invisible column.
   */
  isColumnVisible(): boolean;
  /** Switch layout mode live. */
  setMode(mode: LayoutMode): void;
  /** Remove all injected DOM/CSS. */
  detach(): void;
}
