import { useLayoutEffect, useRef, useState } from 'react';
import { i18n } from '#i18n';
import type { DetailIntent } from '@/core/types';
import { installDetailActions } from './detail-actions';

interface Props {
  intent: DetailIntent;
  frameName: string;
  frameUrl: string;
  onClose: () => void;
  findHeader: (doc: Document) => HTMLElement | null;
}

type LoadState = 'loading' | 'ready' | 'error';
const LOAD_TIMEOUT_MS = 20000;
/**
 * Cadence for detecting the earliest same-origin *interactive* document. Revealing then — instead
 * of on the iframe's full `load` event — lets the platform's own progressive render (its skeleton
 * / spinner) show while trailing subresources finish, so the perceived wait tracks first paint.
 */
const REVEAL_POLL_MS = 100;

/** A detail exists only for a concrete intent. Closing unmounts the entire view and iframe. */
export function IframeColumn({ intent, frameName, frameUrl, onClose, findHeader }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const actionsCleanup = useRef<(() => void) | null>(null);
  const onLoadRef = useRef<() => void>(() => {});
  const onErrorRef = useRef<() => void>(() => {});
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [loadState, setLoadState] = useState<LoadState>('loading');

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let settled = false;
    let activeDoc: Document | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Assigning src leaves the previous document readable until navigation commits.
    // Neither its readyState nor a late load event can signal that the new view is ready.
    let previousDoc: Document | null = null;
    try {
      previousDoc = frame.contentDocument;
    } catch {
      // A previously blocked/cross-origin view has no readable document to exclude.
    }

    const stop = (): void => {
      if (poll !== null) clearInterval(poll);
      if (timer !== null) clearTimeout(timer);
      poll = timer = null;
    };

    /** The frame's document once it is same-origin, readable and past the blank placeholder. */
    const sameOriginDoc = (): Document | null => {
      try {
        const doc = frame.contentDocument;
        if (!doc || doc === previousDoc || doc.URL === 'about:blank') return null;
        return new URL(doc.URL).origin === new URL(frameUrl).origin ? doc : null;
      } catch {
        return null; // cross-origin: not ours to read
      }
    };

    const ready = (doc: Document): void => {
      if (doc === activeDoc) return;
      activeDoc = doc;
      settled = true;
      stop();
      setLoadState('ready');
      if (!doc.documentElement) return;
      actionsCleanup.current?.();
      actionsCleanup.current = installDetailActions(doc, findHeader, {
        rootUrl: intent.url,
        href: () => {
          const current = new URL(doc.URL);
          if (current.href === frameUrl) return intent.url;
          if (!new URL(intent.url).searchParams.has('lang')) current.searchParams.delete('lang');
          return current.origin === new URL(intent.url).origin ? current.href : intent.url;
        },
        onClose: () => closeRef.current(),
      });
    };

    const fail = (): void => {
      activeDoc = null;
      actionsCleanup.current?.();
      actionsCleanup.current = null;
      settled = true;
      stop();
      setLoadState('error');
    };

    onLoadRef.current = (): void => {
      let raw: Document | null = null;
      try {
        raw = frame.contentDocument;
      } catch {
        raw = null;
      }
      // Blank and previous-document loads can race the requested navigation — ignore them.
      if (raw?.URL === 'about:blank' || (raw && raw === previousDoc)) return;
      const doc = sameOriginDoc();
      if (doc) ready(doc);
      else fail();
    };
    onErrorRef.current = fail;

    actionsCleanup.current?.();
    actionsCleanup.current = null;
    setLoadState('loading');
    frame.name = frameName;
    frame.src = frameUrl;

    poll = setInterval(() => {
      const doc = sameOriginDoc();
      if (doc && doc.readyState !== 'loading') ready(doc);
    }, REVEAL_POLL_MS);
    // iframe onError is unreliable for blocked documents; bound the loading UI as a backstop.
    timer = setTimeout(() => {
      if (!settled) fail();
    }, LOAD_TIMEOUT_MS);

    return () => {
      stop();
      actionsCleanup.current?.();
      actionsCleanup.current = null;
    };
  }, [frameUrl, frameName, intent.url, findHeader]);

  const closeLabel = i18n.t('common.close');
  const openLabel = i18n.t('common.openInNewTab');

  return (
    <div className="sv-column">
      <div className="sv-body" aria-busy={loadState === 'loading'}>
        {loadState === 'loading' && (
          <div className="sv-loading" role="status">
            <span>{i18n.t('detail.loading')}</span>
            <div className="sv-status-actions">
              <button type="button" title={closeLabel} onClick={onClose}>
                {closeLabel}
              </button>
            </div>
          </div>
        )}
        {loadState === 'error' && (
          <div className="sv-error" role="alert">
            <span>{i18n.t('detail.loadError')}</span>
            <div className="sv-status-actions">
              <a href={intent.url} target="_blank" rel="noopener noreferrer">
                {openLabel}
              </a>
              <button type="button" title={closeLabel} onClick={onClose}>
                {closeLabel}
              </button>
            </div>
          </div>
        )}

        <iframe
          ref={frameRef}
          title={i18n.t('detail.frameTitle')}
          className="sv-frame"
          style={{ visibility: loadState === 'ready' ? 'visible' : 'hidden' }}
          onLoad={() => onLoadRef.current()}
          onError={() => onErrorRef.current()}
        />
      </div>
    </div>
  );
}
