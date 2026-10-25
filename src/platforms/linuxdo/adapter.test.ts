import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickAdapter } from '../registry';
import { LinuxdoAdapter } from './adapter';
import { parseTopicUrl } from './urls';

const adapter = new LinuxdoAdapter();
const intent = (id: string) =>
  adapter.resolveIntent({ target: document.getElementById(id) } as unknown as MouseEvent);

beforeEach(() => {
  vi.stubGlobal('location', new URL('https://linux.do/'));
  document.body.innerHTML = `<div id="main-outlet-wrapper"><div class="sidebar-wrapper"></div>
    <div id="main-outlet"><div class="topic-list"><table><tbody>
      <tr class="topic-list-item">
        <td class="main-link">
          <a id="title" class="title raw-topic-link" href="/t/topic/3057096">Topic</a>
          <a id="post" class="post-activity" href="/t/topic/3057096/47">47 replies</a>
        </td>
      </tr>
      <tr class="topic-list-item">
        <td class="main-link">
          <a id="bare" class="title raw-topic-link" href="/t/999">Bare id</a>
          <a id="author" href="/u/linuxdo" data-user-card="linuxdo">Author</a>
          <a id="category" href="/c/feedback/2">Category</a>
          <a id="external" href="https://example.test/t/topic/1">External</a>
          <a id="pin" class="topic-status pin-toggle-button" href="">Pin</a>
          <span id="blank"></span>
        </td>
      </tr>
    </tbody></table></div></div></div>`;
});
afterEach(() => vi.unstubAllGlobals());

describe('linux.do topic urls', () => {
  it('accepts the slug, bare-id and deep-post forms on both hosts', () => {
    for (const [href, id] of [
      ['/t/topic/3057096', '3057096'],
      ['/t/some-slug/3057096/47', '3057096'],
      ['/t/topic/3057096/last', '3057096'],
      ['/t/999', '999'],
      ['https://www.linux.do/t/topic/42', '42'],
    ] as const)
      expect(parseTopicUrl(new URL(href, 'https://linux.do/'))).toEqual({ topicId: id });
  });

  it('rejects non-topic routes and other hosts', () => {
    for (const href of [
      '/u/linuxdo',
      '/c/feedback/2',
      '/latest',
      '/t/not-a-topic',
      'http://linux.do/t/topic/1',
      'https://linux.do.evil.test/t/topic/1',
      'https://forum.linux.do/t/topic/1',
    ])
      expect(parseTopicUrl(new URL(href, 'https://linux.do/'))).toBeNull();
  });
});

describe('Linuxdo adapter', () => {
  it('selects only the supported HTTPS hosts', () => {
    expect(pickAdapter(new URL('https://linux.do/'))?.id).toBe('linuxdo');
    expect(pickAdapter(new URL('https://www.linux.do/t/topic/1'))?.id).toBe('linuxdo');
    for (const url of [
      'http://linux.do/',
      'https://linux.do.evil.test/',
      'https://forum.linux.do/',
    ])
      expect(pickAdapter(new URL(url))).toBeNull();
  });

  it('reports the outlet as the primary column while a topic list is visible', () => {
    const primary = adapter.getPrimaryColumn();
    expect(primary?.id).toBe('main-outlet');
    document.querySelector('.topic-list')?.remove();
    expect(adapter.getPrimaryColumn()).toBeNull();
  });

  it('reserves the column as wrapper padding inline with !important and releases it cleanly', () => {
    const wrapper = document.querySelector<HTMLElement>('#main-outlet-wrapper');
    if (!wrapper) throw new Error('Missing wrapper');
    expect(adapter.columnPosition).toBe('split');
    // The drag handle ships enabled here, like on nodeloc.
    expect(adapter.resizable).toBe(true);
    adapter.applyGridReservation('var(--sv-column-width, 0px)');
    expect(wrapper.style.getPropertyPriority('padding-right')).toBe('important');
    expect(wrapper.style.getPropertyValue('padding-right')).toBe('var(--sv-column-width, 0px)');
    // The grid template itself is never touched: it varies by breakpoint and sidebar state.
    expect(wrapper.style.getPropertyValue('grid-template-columns')).toBe('');
    adapter.applyGridReservation(null);
    expect(wrapper.style.getPropertyValue('padding-right')).toBe('');
  });

  it('ignores the reservation when the wrapper is absent', () => {
    expect(() => adapter.applyGridReservation('600px')).not.toThrow();
    expect(() => adapter.applyGridReservation(null)).not.toThrow();
  });

  it('opens topic rows: the title and deep post links', () => {
    for (const id of ['title', 'post', 'bare']) {
      const path =
        id === 'post' ? '/t/topic/3057096/47' : id === 'bare' ? '/t/999' : '/t/topic/3057096';
      expect(intent(id)).toEqual({
        kind: 'status',
        url: `https://linux.do${path}`,
        meta: { statusId: id === 'bare' ? '999' : '3057096' },
      });
    }
    expect(adapter.detailFrameUrl('https://linux.do/t/topic/1/5')).toBe(
      'https://linux.do/t/topic/1/5',
    );
  });

  it('leaves author cards, categories, pin toggles and external links native', () => {
    for (const id of ['author', 'category', 'pin', 'external']) expect(intent(id)).toBeNull();
    document.getElementById('title')?.setAttribute('download', '');
    expect(intent('title')).toBeNull();
  });

  it('opens the row topic from linkless spots', () => {
    expect(intent('blank')).toEqual({
      kind: 'status',
      url: 'https://linux.do/t/999',
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
    outside.href = '/t/topic/3057096';
    document.getElementById('main-outlet-wrapper')?.append(outside);
    expect(intent('outside')).toBeNull();
    document.body.innerHTML = '<div role="dialog"><a id="in-dialog" href="/t/topic/1"></a></div>';
    expect(intent('in-dialog')).toBeNull();
  });

  it('docks the column to the centered wrapper edge and falls back without a wrapper', () => {
    document.body.innerHTML = '<div id="main-outlet-wrapper"></div>';
    const wrapper = document.querySelector<HTMLElement>('#main-outlet-wrapper');
    if (!wrapper) throw new Error('Missing wrapper');
    vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      right: 600,
      width: 500,
    } as DOMRect);
    expect(adapter.columnRight()).toBe(600);
    wrapper.remove();
    expect(adapter.columnRight()).toBeNull();
  });

  it('starts the column below the persistent global header and keeps stylesheets unlifted', () => {
    document.body.innerHTML = '<header class="d-header"></header>';
    const header = document.querySelector<HTMLElement>('.d-header');
    if (!header) throw new Error('Missing header');
    Object.defineProperty(header, 'offsetHeight', { value: 52, configurable: true });
    expect(adapter.columnTop()).toBe(52);
    header.remove();
    expect(adapter.columnTop()).toBe(0);
    expect(adapter.layoutCss('replace-sidebar')).not.toMatch(/z-index/);
  });

  it('joins the topic title row, the header title row when scrolled, then the h1', () => {
    document.body.innerHTML =
      '<div id="main-outlet"><div class="container" id="topic-title">' +
      '<div class="title-wrapper"><h1><a class="fancy-title">T</a></h1>' +
      '<div class="topic-category">C</div></div></div></div>';
    expect(adapter.detailHeader(document)?.className).toBe('title-wrapper');
    // Scrolled deep, the virtualized stream reclaims the in-content title and only the header's
    // extra-info wrapper holds one.
    document.body.innerHTML =
      '<div class="d-header-wrap"><header class="d-header"><div class="wrap"><div class="contents">' +
      '<div class="extra-info-wrapper"><div class="title-wrapper"><h1>Deep</h1></div></div>' +
      '</div></div></header></div>';
    expect(adapter.detailHeader(document)?.className).toBe('title-wrapper');
    document.body.innerHTML = '<div id="main-outlet"><h1><a class="fancy-title">T</a></h1></div>';
    // A block h1 wins over the inline fancy-title anchor so actions right-align, not trail the text.
    expect(adapter.detailHeader(document)?.tagName).toBe('H1');
    expect(adapter.detailHeader(document)?.className).not.toBe('fancy-title');
  });
});
