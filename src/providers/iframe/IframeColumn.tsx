import { useLayoutEffect, useRef, useState } from 'react';
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
  const [nativeActions, setNativeActions] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  // `ready` fires at first interactive paint; `fullyLoaded` waits for the real load event so the
  // "header unavailable" fallback never flashes during the platform's own client render.
  const [fullyLoaded, setFullyLoaded] = useState(false);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let settled = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const stop = (): void => {
      if (poll !== null) clearInterval(poll);
      if (timer !== null) clearTimeout(timer);
      poll = timer = null;
    };

    /** The frame's document once it is same-origin, readable and past the blank placeholder. */
    const sameOriginDoc = (): Document | null => {
      try {
        const doc = frame.contentDocument;
        if (!doc || doc.URL === 'about:blank') return null;
        return new URL(doc.URL).origin === new URL(frameUrl).origin ? doc : null;
      } catch {
        return null; // cross-origin: not ours to read
      }
    };

    const ready = (doc: Document): void => {
      if (settled) return;
      settled = true;
      stop();
      setLoadState('ready');
      if (!doc.documentElement) return;
      actionsCleanup.current?.();
      actionsCleanup.current = installDetailActions(doc, findHeader, {
        href: () => {
          const current = new URL(doc.URL);
          if (current.href === frameUrl) return intent.url;
          if (!new URL(intent.url).searchParams.has('lang')) current.searchParams.delete('lang');
          return current.origin === new URL(intent.url).origin ? current.href : intent.url;
        },
        onClose: () => closeRef.current(),
        onMounted: setNativeActions,
      });
    };

    const fail = (): void => {
      if (settled) return;
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
      // The initial about:blank load races the requested navigation — ignore it.
      if (raw?.URL === 'about:blank') return;
      const doc = sameOriginDoc();
      if (doc) {
        ready(doc);
        setFullyLoaded(true);
      } else fail();
    };
    onErrorRef.current = fail;

    actionsCleanup.current?.();
    actionsCleanup.current = null;
    setNativeActions(false);
    setFullyLoaded(false);
    setLoadState('loading');
    frame.name = frameName;
    frame.src = frameUrl;

    poll = setInterval(() => {
      const doc = sameOriginDoc();
      if (doc && doc.readyState !== 'loading') ready(doc);
    }, REVEAL_POLL_MS);
    // iframe onError is unreliable for blocked documents; bound the loading UI as a backstop.
    timer = setTimeout(fail, LOAD_TIMEOUT_MS);

    return () => {
      stop();
      actionsCleanup.current?.();
      actionsCleanup.current = null;
    };
  }, [frameUrl, frameName, intent.url, findHeader]);

  return (
    <div className="sv-column">
      <div className="sv-body" aria-busy={loadState === 'loading'}>
        {loadState === 'loading' && (
          <div className="sv-loading" role="status">
            <span>Loading…</span>
            <div className="sv-status-actions">
              <button type="button" title="Close" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
        {loadState === 'error' && (
          <div className="sv-error" role="alert">
            <span>Couldn’t load this view here.</span>
            <div className="sv-status-actions">
              <a href={intent.url} target="_blank" rel="noopener noreferrer">
                Open in a new tab
              </a>
              <button type="button" title="Close" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
        {loadState === 'ready' && fullyLoaded && !nativeActions && (
          <div className="sv-header-unavailable">
            <div className="sv-status-actions">
              <a href={intent.url} target="_blank" rel="noopener noreferrer">
                Open in a new tab
              </a>
              <button type="button" title="Close" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
        <iframe
          ref={frameRef}
          title="side-view detail"
          className="sv-frame"
          style={{ visibility: loadState === 'ready' ? 'visible' : 'hidden' }}
          onLoad={() => onLoadRef.current()}
          onError={() => onErrorRef.current()}
        />
      </div>
    </div>
  );
}
