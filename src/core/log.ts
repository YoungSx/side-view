const PREFIX = '[side-view]';

/** Tiny namespaced logger — the single place console access is centralised. */
export const log = {
  debug: (...args: unknown[]): void => console.debug(PREFIX, ...args),
  warn: (...args: unknown[]): void => console.warn(PREFIX, ...args),
  error: (...args: unknown[]): void => console.error(PREFIX, ...args),
};
