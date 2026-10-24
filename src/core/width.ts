/**
 * Shared detail-column width bounds. The popup slider, the options form and the drag-to-resize
 * handle all clamp to the same range so a stored width is valid wherever it was set.
 */
export const SV_WIDTH_MIN_PX = 320;
export const SV_WIDTH_MAX_PX = 1200;

/** Clamp a width into the adjustable range. */
export function clampColumnWidth(
  width: number,
  min: number = SV_WIDTH_MIN_PX,
  max: number = SV_WIDTH_MAX_PX,
): number {
  return Math.round(Math.min(max, Math.max(min, width)));
}

/**
 * The column's width after dragging its left edge from `startX` to `currentX`. The column sits
 * on the right of the feed, so moving the edge left (negative dx) widens it.
 */
export function resizeColumnWidth(
  startWidth: number,
  startX: number,
  currentX: number,
  min: number = SV_WIDTH_MIN_PX,
  max: number = SV_WIDTH_MAX_PX,
): number {
  return clampColumnWidth(startWidth + (startX - currentX), min, max);
}
