/** Shared DOM fixtures + query helpers for unit tests. */

/**
 * A minimal slice of the x.com layout: a primary column with one tweet (which itself quotes
 * another tweet), plus a sidebar. A quoted tweet is a `role="link"` block carrying its OWN
 * permalink — not a nested `<article>` — matching how X renders quotes.
 */
export const X_TIMELINE_HTML = `
  <main role="main"><div><div>
    <div data-testid="primaryColumn">
      <article data-testid="tweet">
        <div data-testid="User-Name"><a href="/jack" id="name">Jack</a></div>
        <a href="/jack/status/123" id="perma"><time datetime="t">1h</time></a>
        <div data-testid="tweetText" id="body">hello world</div>
        <a href="/hashtag/foo" id="tag">#foo</a>
        <a href="/search?q=foo&src=typed_query" id="search">search</a>
        <a href="https://evil.example/status/999" id="external">external status link</a>
        <div data-testid="UserAvatar-Container-jack" id="avatar"></div>
        <div role="button" data-testid="like" id="like">like</div>
        <div role="link" tabindex="0" id="quote">
          <div data-testid="tweetText" id="quote-body">quoted text</div>
          <a href="/beth/status/456"><time datetime="t2">2h</time></a>
        </div>
      </article>
    </div>
    <div data-testid="sidebarColumn"><a href="/other" id="sidelink">trend</a></div>
  </div></div></main>`;

export function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`fixture missing #${id}`);
  return el;
}

export function byQuery<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`fixture missing ${selector}`);
  return el;
}
