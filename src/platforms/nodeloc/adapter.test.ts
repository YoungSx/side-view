import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SV_HOST_ATTR } from '@/core/style-ids';
import { pickAdapter } from '../registry';
import { NodelocAdapter } from './adapter';
import { parseTopicUrl } from './urls';

const adapter = new NodelocAdapter();
const intent = (id: string) =>
  adapter.resolveIntent({ target: document.getElementById(id) } as unknown as MouseEvent);

beforeEach(() => {
  vi.stubGlobal('location', new URL('https://www.nodeloc.com/'));
  document.body.innerHTML = `<div id="main"><div id="main-outlet-wrapper"><aside class="meta-recent-posts"></aside>
    <div id="main-outlet"><div class="topic-list"><table><tbody>
      <tr class="topic-list-item">
        <td class="main-link">
          <a id="overlay" class="community-card-link-overlay" href="/t/topic/115271"></a>
          <a id="title" class="title raw-topic-link" href="/t/topic/115271">Topic</a>
          <a id="post" class="post-activity" href="/t/topic/115271/47">47 replies</a>
        </td>
      </tr>
      <tr class="topic-list-item">
        <td class="main-link">
          <a id="bare" class="title raw-topic-link" href="/t/999">Bare id</a>
          <a id="author" href="/u/xiaoyi669" data-user-card="xiaoyi669">Author</a>
          <a id="category" href="/n/open-sharing">Category</a>
          <a id="external" href="https://example.test/t/topic/1">External</a>
          <span id="blank"></span>
        </td>
      </tr>
    </tbody></table></div></div></div></div>`;
});
afterEach(() => vi.unstubAllGlobals());

describe('nodeloc topic urls', () => {
  it('accepts the slug, bare-id and deep-post forms on both hosts', () => {
    for (const [href, id] of [
      ['/t/topic/115271', '115271'],
      ['/t/topic/115271/47', '115271'],
      ['/t/topic/115271/last', '115271'],
      ['/t/999', '999'],
      ['https://nodeloc.com/t/some-slug/42', '42'],
    ] as const)
      expect(parseTopicUrl(new URL(href, 'https://www.nodeloc.com/'))).toEqual({ topicId: id });
  });

  it('rejects non-topic routes and other hosts', () => {
    for (const href of [
      '/n/open-sharing',
      '/u/xiaoyi669',
      '/c/technology/36',
      '/latest',
      '/t/not-a-topic',
      'http://www.nodeloc.com/t/topic/1',
      'https://www.nodeloc.com.evil.test/t/topic/1',
    ])
      expect(parseTopicUrl(new URL(href, 'https://www.nodeloc.com/'))).toBeNull();
  });
});

describe('Nodeloc adapter', () => {
  it('selects only the supported HTTPS hosts', () => {
    expect(pickAdapter(new URL('https://www.nodeloc.com/'))?.id).toBe('nodeloc');
    expect(pickAdapter(new URL('https://nodeloc.com/t/topic/1'))?.id).toBe('nodeloc');
    for (const url of [
      'http://www.nodeloc.com/',
      'https://www.nodeloc.com.evil.test/',
      'https://forum.nodeloc.com/',
    ])
      expect(pickAdapter(new URL(url))).toBeNull();
  });

  it('reports the outlet as the primary column while a topic list is visible', () => {
    const primary = adapter.getPrimaryColumn();
    expect(primary?.id).toBe('main-outlet');
    document.querySelector('.topic-list')?.remove();
    expect(adapter.getPrimaryColumn()).toBeNull();
  });

  it('opens topic rows: the card overlay, the title and deep post links', () => {
    for (const id of ['overlay', 'title', 'post', 'bare']) {
      expect(intent(id)).toEqual({
        kind: 'status',
        url: `https://www.nodeloc.com${id === 'post' ? '/t/topic/115271/47' : id === 'bare' ? '/t/999' : id === 'overlay' ? '/t/topic/115271' : '/t/topic/115271'}`,
        meta: { statusId: id === 'bare' ? '999' : '115271' },
      });
    }
    expect(adapter.detailFrameUrl('https://www.nodeloc.com/t/topic/1/5')).toBe(
      'https://www.nodeloc.com/t/topic/1/5',
    );
  });

  it('leaves author cards, categories and external links native', () => {
    for (const id of ['author', 'category', 'external']) expect(intent(id)).toBeNull();
    document.getElementById('title')?.setAttribute('download', '');
    expect(intent('title')).toBeNull();
  });

  it('opens the row topic from linkless spots, mirroring the overlay layouts', () => {
    // The compact layout draws no full-row overlay; blank areas must still open the row topic.
    expect(intent('blank')).toEqual({
      kind: 'status',
      url: 'https://www.nodeloc.com/t/999',
      meta: { statusId: '999' },
    });
    const cell = document.createElement('td');
    cell.id = 'cell-blank';
    document.getElementById('bare')?.parentElement?.append(cell);
    expect(intent('cell-blank')).toEqual(intent('blank'));
  });

  it('stays native when a linkless row has no topic title link', () => {
    document.getElementById('bare')?.remove();
    expect(intent('blank')).toBeNull();
  });

  it('does not intercept links outside a topic list or inside dialogs', () => {
    const outside = document.createElement('a');
    outside.id = 'outside';
    outside.href = '/t/topic/115271';
    document.getElementById('main-outlet-wrapper')?.append(outside);
    expect(intent('outside')).toBeNull();
    document.body.innerHTML = '<div role="dialog"><a id="in-dialog" href="/t/topic/1"></a></div>';
    expect(intent('in-dialog')).toBeNull();
  });

  it('lifts the column above the theme header (z-index 1000) while it is open', () => {
    const css = adapter.layoutCss('replace-sidebar');
    expect(css).toMatch(new RegExp(`z-index:\\s*1001\\s*!important`));
    expect(css).toContain(SV_HOST_ATTR);
  });

  it('uses the nested-view header row, falling back to real title rows', () => {    document.body.innerHTML =
      '<div id="main-outlet"><div class="nested-view__header"><h1 class="nested-view__title">T</h1></div></div>';
    expect(adapter.detailHeader(document)?.className).toBe('nested-view__header');
    document.body.innerHTML =
      '<div id="main-outlet"><div class="title-wrapper"><h1 class="header-title">Locked</h1></div></div>';
    expect(adapter.detailHeader(document)?.className).toBe('title-wrapper');
    document.body.innerHTML = '<div id="main-outlet"><h1><a class="fancy-title">T</a></h1></div>';
    // A block h1 wins over the inline fancy-title anchor so actions right-align, not trail the text.
    expect(adapter.detailHeader(document)?.tagName).toBe('H1');
    expect(adapter.detailHeader(document)?.className).not.toBe('fancy-title');
  });
});
