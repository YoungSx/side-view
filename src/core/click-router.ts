import type { ContentScriptContext } from '#imports';
import type { DetailIntent, IntentKind, PlatformAdapter } from '@/core/types';

export type IntentHandler = (intent: DetailIntent) => void;
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
    // Column hidden (e.g. sub-breakpoint viewport): don't cancel the user's only way to navigate.
    if (!this.canIntercept()) return;
    const intent = this.adapter.resolveIntent(event);
    if (!intent || !this.policy(intent.kind)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.onIntent(intent);
  };
}
