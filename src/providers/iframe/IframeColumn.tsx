import { useLayoutEffect, useRef, useState } from 'react';
import type { DetailIntent } from '@/core/types';

interface Props {
  intent: DetailIntent;
  frameName: string;
  frameUrl: string;
  onClose: () => void;
}

type LoadState = 'loading' | 'ready' | 'error';
const LOAD_TIMEOUT_MS = 20000;

function titleFor(intent: DetailIntent): string {
  switch (intent.kind) {
    case 'status':
      return intent.meta?.handle ? `@${intent.meta.handle}` : 'Tweet';
    case 'profile':
      return intent.meta?.handle ? `@${intent.meta.handle}` : 'Profile';
    case 'hashtag':
      return 'Hashtag';
    case 'search':
      return intent.meta?.query ?? 'Search';
  }
}

/** A detail exists only for a concrete intent. Closing unmounts the entire view and iframe. */
export function IframeColumn({ intent, frameName, frameUrl, onClose }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const finish = (state: LoadState): void => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    setLoadState(state);
  };

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    setLoadState('loading');
    frame.name = frameName;
    frame.src = frameUrl;
    // iframe onError is unreliable for blocked documents. Bound the loading UI as well.
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setLoadState('error');
    }, LOAD_TIMEOUT_MS);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [frameUrl, frameName]);

  const loaded = (): void => {
    try {
      const doc = frameRef.current?.contentDocument;
      // Ignore the initial empty document's load, which can race with the requested navigation.
      if (doc?.URL === 'about:blank') return;
      finish(doc && new URL(doc.URL).origin === new URL(frameUrl).origin ? 'ready' : 'error');
    } catch {
      finish('error');
    }
  };

  return (
    <div className="sv-column">
      <header className="sv-bar">
        <span className="sv-title">{titleFor(intent)}</span>
        <a
          className="sv-action"
          href={intent.url}
          target="_blank"
          rel="noreferrer"
          title="Open in a new tab"
        >
          ↗
        </a>
        <button type="button" className="sv-action" onClick={onClose} title="Close">
          ✕
        </button>
      </header>
      <div className="sv-body" aria-busy={loadState === 'loading'}>
        {loadState === 'loading' && (
          <div className="sv-loading" role="status">
            Loading…
          </div>
        )}
        {loadState === 'error' && (
          <div className="sv-error" role="alert">
            Couldn’t load this view here.{' '}
            <a href={intent.url} target="_blank" rel="noreferrer">
              Open in a new tab
            </a>
            .
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
