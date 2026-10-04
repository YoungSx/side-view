import type { PlatformAdapter } from '@/core/types';
import { BlueskyAdapter } from '@/platforms/bluesky/adapter';
import { XAdapter } from '@/platforms/x/adapter';
import { XiaohongshuAdapter } from '@/platforms/xiaohongshu/adapter';

/**
 * Build the platform adapter that owns `url`, or null. `overrides` are the user's selector patches.
 * This registry is only for iframe-rendered platforms. Threads has a dedicated native entrypoint.
 */
export function pickAdapter(
  url: URL,
  overrides: Readonly<Record<string, string>> = {},
): PlatformAdapter | null {
  const x = new XAdapter(overrides);
  if (x.matches(url)) return x;
  const bluesky = new BlueskyAdapter(overrides);
  if (bluesky.matches(url)) return bluesky;
  const xiaohongshu = new XiaohongshuAdapter();
  return xiaohongshu.matches(url) ? xiaohongshu : null;
}
