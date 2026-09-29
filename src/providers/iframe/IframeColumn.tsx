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

/** A detail exists only for a concrete intent. Closing unmounts the entire view and iframe. */
export function IframeColumn({ intent, frameName, frameUrl, onClose, findHeader }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionsCleanup = useRef<(() => void) | null>(null);
  const [nativeActions, setNativeActions] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const finish = (state: LoadState): void => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    setLoadState(state);
  };

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    actionsCleanup.current?.();
    actionsCleanup.current = null;
    setNativeActions(false);
    setLoadState('loading');
    frame.name = frameName;
    frame.src = frameUrl;
    // iframe onError is unreliable for blocked documents. Bound the loading UI as well.
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setLoadState('error');
    }, LOAD_TIMEOUT_MS);
    return () => {
      actionsCleanup.current?.();
      actionsCleanup.current = null;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [frameUrl, frameName]);

  const loaded = (): void => {
    try {
      const doc = frameRef.current?.contentDocument;
      // Ignore the initial empty document's load, which can race with the requested navigation.
      if (doc?.URL === 'about:blank') return;
      const ready = !!doc && new URL(doc.URL).origin === new URL(frameUrl).origin;
      finish(ready ? 'ready' : 'error');
      if (ready && doc?.documentElement) {
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
      }
    } catch {
      finish('error');
    }
  };

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
        {loadState === 'ready' && !nativeActions && (
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
          onLoad={loaded}
          onError={() => finish('error')}
        />
      </div>
    </div>
  );
}
