import { browser } from '#imports';
import { settings } from '@/settings/storage';

/** Locales the user may pick, plus `auto` to follow the browser UI language. */
export const UI_LANGUAGES = ['auto', 'en', 'zh_CN', 'zh_TW', 'ja'] as const;

export type UiLanguage = (typeof UI_LANGUAGES)[number];

const loaders: Record<Exclude<UiLanguage, 'auto'>, () => Promise<{ default: unknown }>> = {
  en: () => import('@/locales/en.json'),
  zh_CN: () => import('@/locales/zh_CN.json'),
  zh_TW: () => import('@/locales/zh_TW.json'),
  ja: () => import('@/locales/ja.json'),
};

/**
 * Flatten a locale file the way the build does: nested dots become underscores, `{ message }`
 * wrappers unwrap to their text. `options.general.title` becomes `options_general_title`.
 */
export function flattenMessages(
  node: unknown,
  prefix = '',
  out = new Map<string, string>(),
): Map<string, string> {
  if (typeof node === 'string') {
    out.set(prefix, node);
    return out;
  }
  if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (typeof record.message === 'string' && prefix) {
      out.set(prefix, record.message);
      return out;
    }
    for (const [key, value] of Object.entries(record))
      flattenMessages(value, prefix ? `${prefix}_${key}` : key, out);
  }
  return out;
}

/** Chrome's `$1`–`$9` positional substitution; `$$` is a literal dollar sign. */
export function substitute(message: string, subs: string[]): string {
  return message.replace(/\$(\$|[1-9])/g, (match, token: string) =>
    token === '$' ? '$' : (subs[Number(token) - 1] ?? match),
  );
}

/** null = follow the browser. Each locale is a separate chunk, fetched only when picked. */
let override: Map<string, string> | null = null;
/** The real `getMessage`, captured before the first patch so `auto` and misses fall through. */
let passthrough: typeof browser.i18n.getMessage | null = null;

function getMessage(name: string, substitutions?: string | string[]): string {
  const message = override?.get(name);
  if (message !== undefined) {
    const subs =
      substitutions === undefined
        ? []
        : Array.isArray(substitutions)
          ? substitutions.map(String)
          : [String(substitutions)];
    return substitute(message, subs);
  }
  // `name` is any key the caller asked for; the typed overloads only cover generated ones.
  const real = passthrough ?? browser.i18n.getMessage;
  return (real as (key: string, subs?: string | string[]) => string)(name, substitutions);
}

/**
 * Point every `i18n.t()` call at `language` until changed again. Patching `getMessage` once is
 * what lets the runtime locale reach content scripts and the options page alike without either
 * of them knowing this module exists.
 */
export async function setUiLanguage(language: UiLanguage): Promise<void> {
  if (language === 'auto') {
    override = null;
    return;
  }
  const { default: messages } = await loaders[language]();
  if (!passthrough) {
    passthrough = browser.i18n.getMessage;
    browser.i18n.getMessage = getMessage;
  }
  override = flattenMessages(messages);
}

/** The BCP 47 tag to put on `<html lang>`: the picked locale, else the browser's. */
export function activeLanguage(language: UiLanguage = 'auto'): string {
  const tag = language === 'auto' ? (browser.i18n.getUILanguage?.() ?? 'en') : language;
  return tag.replace('_', '-');
}

/** Apply the stored preference. Await before the first render to avoid a wrong-language flash. */
export async function applyStoredLanguage(): Promise<void> {
  await setUiLanguage(await settings.uiLanguage.getValue());
}
