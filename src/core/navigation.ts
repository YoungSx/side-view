/** The frame-local subset of the Navigation API used by our native Back integration. */
export interface FrameNavigation {
  readonly currentEntry: { key: string; index: number } | null;
  entries(): { key: string; index: number }[];
  traverseTo(key: string): { committed: Promise<unknown>; finished: Promise<unknown> };
}

export function frameNavigation(win: Window | null): FrameNavigation | undefined {
  return (win as (Window & { navigation?: FrameNavigation }) | null)?.navigation;
}
