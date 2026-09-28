import { storage } from '#imports';
import type { LayoutMode } from '@/core/types';

/**
 * Typed, synced settings. Each item lives in `chrome.storage.sync` (cross-device) with a fallback,
 * and exposes `.getValue()` / `.setValue()` / `.watch()`. The options page writes them; content
 * scripts and the background worker read and watch them.
 */
export const settings = {
  /** Master on/off for the whole feature. */
  enabled: storage.defineItem<boolean>('sync:enabled', { fallback: true }),
  /** How the detail column sits in the layout. */
  layoutMode: storage.defineItem<LayoutMode>('sync:layoutMode', { fallback: 'replace-sidebar' }),
  /** Detail column width, in CSS px. */
  columnWidth: storage.defineItem<number>('sync:columnWidth', { fallback: 600 }),
  /** Also open profile / hashtag / search links in the side column (phase-1 default: off). */
  interceptProfilesAndTags: storage.defineItem<boolean>('sync:interceptProfilesAndTags', {
    fallback: false,
  }),
  /** Per-key selector overrides, applied over the built-in x.com selector map (DOM-drift hedge). */
  selectorOverrides: storage.defineItem<Record<string, string>>('sync:selectorOverrides', {
    fallback: {},
  }),
} as const;

export type SettingsKey = keyof typeof settings;

/** A plain snapshot of all setting values. */
export interface SettingsSnapshot {
  enabled: boolean;
  layoutMode: LayoutMode;
  columnWidth: number;
  interceptProfilesAndTags: boolean;
  selectorOverrides: Record<string, string>;
}

/** Read every setting once. */
export async function loadSettings(): Promise<SettingsSnapshot> {
  const [enabled, layoutMode, columnWidth, interceptProfilesAndTags, selectorOverrides] =
    await Promise.all([
      settings.enabled.getValue(),
      settings.layoutMode.getValue(),
      settings.columnWidth.getValue(),
      settings.interceptProfilesAndTags.getValue(),
      settings.selectorOverrides.getValue(),
    ]);
  return {
    enabled,
    layoutMode,
    columnWidth,
    interceptProfilesAndTags,
    selectorOverrides,
  };
}
