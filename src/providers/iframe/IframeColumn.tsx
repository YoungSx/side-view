import { useLayoutEffect, useRef, useState } from 'react';
import type { DetailIntent } from '@/core/types';

interface Props {
  intent: DetailIntent | null;
  frameName: string;
  onClose: () => void;
}

function titleFor(intent: DetailIntent | null): string {
  if (!intent) return 'side-view';
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

/**
 * The detail column's chrome + the reused, same-origin `<iframe>`.
 *
 * The iframe is a single persistent element: its `name` is set (so the in-frame chrome-stripper
 * recognises it) and its `src` is assigned imperatively — assigning `src` on the existing element
 * navigates it in place, reusing one frame rather than spawning a second X app per click.
 */
export function IframeColumn({ intent, frameName, onClose }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  // The URL we last told the frame to load. `frame.src` reflects only the last assignment, not the
  // frame's current location after in-frame navigation, so it can't tell us whether re-opening the
  // same tweet needs a reload. Track our own intent instead.
  const loadedUrlRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    // Closed/empty: tear the framed document down so a hidden X SPA isn't left polling in the
    // background (a display:none iframe keeps its document fully alive otherwise).
    if (!intent) {
      if (loadedUrlRef.current !== null) {
        frame.src = 'about:blank';
        loadedUrlRef.current = null;
        setLoading(false);
        setErrored(false);
      }
      return;
    }

    frame.name = frameName; // must precede src so window.name is readable in-frame
    // Reload when the requested intent differs from what we last loaded — including re-opening the
    // same tweet after the user navigated away inside the frame (loadedUrlRef, not frame.src).
    if (loadedUrlRef.current !== intent.url) {
      loadedUrlRef.current = intent.url;
      setLoading(true);
      setErrored(false);
      frame.src = intent.url;
    }
  }, [intent, frameName]);

  return (
    <div className="sv-column">
      <header className="sv-bar">
        <span className="sv-title">{titleFor(intent)}</span>
        {intent && (
          <a
            className="sv-action"
            href={intent.url}
            target="_blank"
            rel="noreferrer"
            title="Open in a new tab"
          >
            ↗
          </a>
        )}
        <button type="button" className="sv-action" onClick={onClose} title="Close">
          ✕
        </button>
      </header>
      <div className="sv-body">
        {!intent && <p className="sv-empty">Click a tweet to open it here.</p>}
        {intent && loading && <div className="sv-loading">Loading…</div>}
        {intent && errored && (
          <div className="sv-error">
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
          className={intent ? 'sv-frame' : 'sv-frame sv-hidden'}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setErrored(true);
          }}
        />
      </div>
    </div>
  );
}
