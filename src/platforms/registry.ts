import type { PlatformAdapter } from '@/core/types';
import { XAdapter } from '@/platforms/x/adapter';

/**
 * Build the platform adapter that owns `url`, or null. `overrides` are the user's selector patches.
 * New platforms (BlueSky/Threads) are registered by adding their adapter to this function.
 */
export function pickAdapter(
  url: URL,
  overrides: Readonly<Record<string, string>> = {},
): PlatformAdapter | null {
  const x = new XAdapter(overrides);
  return x.matches(url) ? x : null;
}
