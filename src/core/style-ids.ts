/** Platform-neutral identifiers for the DOM/CSS we inject into the host page. */
export const SV_ACTIVE_CLASS = 'sv-active';
export const SV_HOST_ATTR = 'data-sideview-host';
export const SV_LAYOUT_STYLE_ID = 'sv-layout-style';

/**
 * Minimum viewport width (CSS px) at which the detail column is shown. Below this the column is
 * hidden AND interception is disabled, so clicks fall through to native navigation instead of
 * opening into an invisible column. The CSS media query and the JS visibility gate both derive
 * from this single constant so they can never drift.
 */
export const SV_MIN_VIEWPORT_PX = 1050;
export const SV_MODE_CLASS: Record<'replace-sidebar' | 'insert-column', string> = {
  'replace-sidebar': 'sv-mode-replace',
  'insert-column': 'sv-mode-insert',
};
