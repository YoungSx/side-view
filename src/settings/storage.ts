import { storage } from '#imports';
import type { LayoutMode } from '@/core/types';
import type { UiLanguage } from '@/i18n/runtime';

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
  /** Keep the native navigation as an icon rail independently of the detail column. */
  compactNavigation: storage.defineItem<boolean>('sync:compactNavigation', { fallback: false }),
  /** Also open profile / hashtag / search links in the side column (default: on). */
  interceptProfilesAndTags: storage.defineItem<boolean>('sync:interceptProfilesAndTags', {
    fallback: true,
  }),
  /** Per-key selector overrides, applied over the built-in x.com selector map (DOM-drift hedge). */
  selectorOverrides: storage.defineItem<Record<string, string>>('sync:selectorOverrides', {
    fallback: {},
  }),
  /** UI language, or `auto` to follow the browser. Chrome's own locale is immutable at runtime. */
  uiLanguage: storage.defineItem<UiLanguage>('sync:uiLanguage', { fallback: 'auto' }),
} as const;

export type SettingsKey = keyof typeof settings;

/** A plain snapshot of all setting values. */
export interface SettingsSnapshot {
  enabled: boolean;
  layoutMode: LayoutMode;
  columnWidth: number;
  compactNavigation: boolean;
  interceptProfilesAndTags: boolean;
  selectorOverrides: Record<string, string>;
  uiLanguage: UiLanguage;
}

/** Read every setting once. */
export async function loadSettings(): Promise<SettingsSnapshot> {
  const [
    enabled,
    layoutMode,
    columnWidth,
    compactNavigation,
    interceptProfilesAndTags,
    selectorOverrides,
    uiLanguage,
  ] = await Promise.all([
    settings.enabled.getValue(),
    settings.layoutMode.getValue(),
    settings.columnWidth.getValue(),
    settings.compactNavigation.getValue(),
    settings.interceptProfilesAndTags.getValue(),
    settings.selectorOverrides.getValue(),
    settings.uiLanguage.getValue(),
  ]);
  return {
    enabled,
    layoutMode,
    columnWidth,
    compactNavigation,
    interceptProfilesAndTags,
    selectorOverrides,
    uiLanguage,
  };
}
