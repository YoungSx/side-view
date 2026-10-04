import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickAdapter } from '../registry';
import { XiaohongshuAdapter } from './adapter';

const adapter = new XiaohongshuAdapter();
const path = '/explore/0123456789abcdef01234567?xsec_token=test%2Btoken%3D&xsec_source=pc_feed';
const intent = (id: string) =>
  adapter.resolveIntent({ target: document.getElementById(id) } as unknown as MouseEvent);

beforeEach(() => {
  vi.stubGlobal('location', new URL('https://www.xiaohongshu.com/explore'));
  document.body.innerHTML = `<div id="app"><div class="feeds-container">
    <section class="note-item">
      <a id="seo" href="/explore/0123456789abcdef01234567" style="display:none"></a>
      <a class="cover" href="${path}" target="_self"><img id="cover"></a>
      <a href="${path}"><span id="title">Note title</span></a>
      <a id="author" href="/user/profile/0123456789abcdef01234567" target="_blank">Author</a>
      <span class="like-wrapper"><span id="like">5</span></span>
      <span id="blank"></span>
    </section>
  </div></div>`;
});
afterEach(() => vi.unstubAllGlobals());

describe('Xiaohongshu adapter', () => {
  it('selects only the supported HTTPS web host', () => {
    expect(pickAdapter(new URL('https://www.xiaohongshu.com/explore'))?.id).toBe('xiaohongshu');
    for (const url of [
      'http://www.xiaohongshu.com/',
      'https://www.xiaohongshu.com.evil.test/',
      'https://creator.xiaohongshu.com/',
    ])
      expect(pickAdapter(new URL(url))).toBeNull();
  });

  it('opens covers and titles without dropping signed parameters', () => {
    expect(intent('cover')).toEqual({
      kind: 'status',
      url: `https://www.xiaohongshu.com${path}`,
      meta: { statusId: '0123456789abcdef01234567' },
    });
    expect(intent('title')).toEqual(intent('cover'));
    expect(adapter.detailFrameUrl(intent('title')?.url ?? '')).toBe(
      `https://www.xiaohongshu.com${path}`,
    );
  });

  it('leaves likes, blank space and unsigned SEO links native', () => {
    for (const id of ['like', 'blank', 'seo']) expect(intent(id)).toBeNull();
  });

  it('opens native author links as profiles while preserving their access parameters', () => {
    const author = document.getElementById('author');
    const href =
      '/user/profile/0123456789abcdef01234567?xsec_token=profile%2Btoken%3D&xsec_source=pc_feed';
    author?.setAttribute('href', href);
    expect(intent('author')).toEqual({
      kind: 'profile',
      url: `https://www.xiaohongshu.com${href}`,
    });
    author?.setAttribute('target', '_top');
    expect(intent('author')).toBeNull();
  });

  it('uses the note header while a profile note modal is open, then restores profile actions', () => {
    document.body.innerHTML =
      '<div id="userPageContainer"><div class="user-nickname">Author</div></div><div id="noteContainer"><div class="author"><div class="author-wrapper">Note author</div></div></div>';
    expect(adapter.detailHeader(document)?.textContent).toBe('Note author');
    document.getElementById('noteContainer')?.remove();
    expect(adapter.detailHeader(document)?.textContent).toBe('Author');
  });

  it('supplies the native navigation source when the card leaves it empty', () => {
    const link = document.querySelector('a.cover');
    link?.setAttribute('href', path.replace('xsec_source=pc_feed', 'xsec_source='));
    expect(new URL(intent('cover')?.url ?? '').searchParams.get('xsec_source')).toBe('pc_feed');
    link?.setAttribute(
      'href',
      path.replace('/explore/', '/search_result/').replace('&xsec_source=pc_feed', ''),
    );
    expect(new URL(intent('cover')?.url ?? '').searchParams.get('xsec_source')).toBe('pc_search');
    vi.stubGlobal(
      'location',
      new URL('https://www.xiaohongshu.com/user/profile/0123456789abcdef01234567'),
    );
    link?.setAttribute('href', path.replace('&xsec_source=pc_feed', ''));
    expect(new URL(intent('cover')?.url ?? '').searchParams.get('xsec_source')).toBe('pc_user');
  });

  it('normalizes profile note routes while preserving their access token and source', () => {
    document
      .querySelector('a.cover')
      ?.setAttribute(
        'href',
        path
          .replace('/explore/', '/user/profile/abcdef0123456789abcdef01/')
          .replace('pc_feed', 'pc_user'),
      );
    const result = intent('cover');
    expect(result?.url).toBe(`https://www.xiaohongshu.com${path.replace('pc_feed', 'pc_user')}`);
    expect(result?.meta?.statusId).toBe('0123456789abcdef01234567');
  });

  it('accepts signed search result links and rejects lookalikes, subroutes and explicit new tabs', () => {
    const cover = document.querySelector<HTMLAnchorElement>('a.cover');
    if (!cover) throw new Error('Missing fixture');
    cover.href = path.replace('/explore/', '/search_result/');
    expect(intent('cover')?.kind).toBe('status');
    for (const href of [
      `https://evil.test${path}`,
      '/explore/invalid?xsec_token=test',
      path.replace('?', '/comments?'),
    ]) {
      cover.href = href;
      expect(intent('cover')).toBeNull();
    }
    cover.href = path;
    cover.target = '_blank';
    expect(intent('cover')).toBeNull();
    cover.target = '_self';
    cover.setAttribute('download', '');
    expect(intent('cover')).toBeNull();
  });

  it('does not intercept detail dialogs or links outside a feed', () => {
    document.querySelector('.feeds-container')?.classList.add('note-detail-mask');
    expect(intent('cover')).toBeNull();
    document.querySelector('.feeds-container')?.removeAttribute('class');
    expect(intent('cover')).toBeNull();
  });
});
