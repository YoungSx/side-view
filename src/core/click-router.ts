import type { ContentScriptContext } from '#imports';
import type { DetailIntent, IntentKind, PlatformAdapter } from '@/core/types';

/** True only when a visible detail view accepted the intent. */
export type IntentHandler = (intent: DetailIntent) => boolean;
export type InterceptPolicy = (kind: IntentKind) => boolean;
/** Precondition gate: when it returns false, the click falls through to native navigation. */
export type InterceptGate = () => boolean;

/** True when the user has an active, non-empty text selection (a drag-select just ended). */
function hasActiveSelection(): boolean {
  const sel = window.getSelection();
  return sel !== null && !sel.isCollapsed && sel.toString().trim() !== '';
}

/**
 * Capture-phase click interception.
 *
 * Registered on `document` in the CAPTURE phase so it runs before X's delegated (bubble-phase)
 * React handler; when we decide to act we call `stopImmediatePropagation` so X's router never sees
 * the click. Pure classification lives in the adapter; this class owns only policy + cancellation,
 * keeping it platform-agnostic. Modified clicks (new-tab, non-primary button), text-selection
 * gestures, and clicks while the gate is closed (e.g. the column is hidden below the layout
 * breakpoint) are left to the browser. It never touches `keydown`, so keyboard shortcuts are safe.
 */
export class ClickRouter {
  private policy: InterceptPolicy;
  private readonly canIntercept: InterceptGate;

  constructor(
    private readonly adapter: PlatformAdapter,
    private readonly onIntent: IntentHandler,
    policy?: InterceptPolicy,
    canIntercept?: InterceptGate,
  ) {
    this.policy = policy ?? (() => true);
    this.canIntercept = canIntercept ?? (() => true);
  }

  setPolicy(policy: InterceptPolicy): void {
    this.policy = policy;
  }

  install(ctx: ContentScriptContext): void {
    document.addEventListener('click', this.handleClick, true);
    ctx.onInvalidated(() => document.removeEventListener('click', this.handleClick, true));
  }

  private readonly handleClick = (event: MouseEvent): void => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    // A drag to select tweet text ends with a click on the text; leave the selection usable.
    if (hasActiveSelection()) return;
    const intent = this.adapter.resolveIntent(event);
    if (!intent || !this.policy(intent.kind)) return;
    // Classification and policy checks precede any attempt to open the detail.
    if (!this.canIntercept()) return;

    // Snapshot timeline scroll position before layout changes or host reflows
    const target = event.target instanceof Element ? event.target : null;
    const scrollContainer = target?.closest?.('[data-column-scrollable]') as HTMLElement | null;
    const snapshot = {
      windowX: window.scrollX,
      windowY: window.scrollY,
      container: scrollContainer,
      containerTop: scrollContainer?.scrollTop ?? null,
    };

    if (!this.onIntent(intent)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Defend timeline scroll position across microtask and subsequent layout animation frames
    this.restoreScroll(snapshot);
  };

  /**
   * Keep timeline anchored at its reading position when the detail column expands.
   * Host layout changes (hiding sidebar, inserting flex column, or virtual list resize)
   * can transiently truncate scrollHeight or trigger scrollIntoView, resetting scrollTop to 0.
   */
  private restoreScroll(snapshot: {
    windowX: number;
    windowY: number;
    container: HTMLElement | null;
    containerTop: number | null;
  }): void {
    const restore = (): void => {
      let restored = false;
      if (Math.abs(window.scrollY - snapshot.windowY) > 2) {
        window.scrollTo({
          left: snapshot.windowX,
          top: snapshot.windowY,
          behavior: 'instant' as ScrollBehavior,
        });
        restored = true;
      }
      if (
        snapshot.container &&
        snapshot.containerTop !== null &&
        Math.abs(snapshot.container.scrollTop - snapshot.containerTop) > 2
      ) {
        snapshot.container.scrollTop = snapshot.containerTop;
        restored = true;
      }
      if (restored) {
        window.dispatchEvent(new Event('scroll'));
      }
    };

    // Protect across immediate microtask and two consecutive animation frames
    queueMicrotask(restore);
    requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
    });
  }
}
