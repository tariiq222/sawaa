import { renderBlocksToHtml } from './render-blocks';
import type { EmailBlock } from './email-block.types';

describe('renderBlocksToHtml', () => {
  it('declares Arabic language and RTL direction on the outer email wrapper', () => {
    const blocks: EmailBlock[] = [{ id: 'reminder', type: 'paragraph', text: 'مرحباً {{client_name}}، موعدك غداً.' }];
    const html = renderBlocksToHtml(blocks);
    const wrapper = html.split('\n')[0];

    expect(wrapper).toMatch(/^<div\b[^>]*\bdir="rtl"/);
    expect(wrapper).toMatch(/^<div\b[^>]*\blang="ar"/);
    expect(html).toContain('مرحباً {{client_name}}، موعدك غداً.');
  });

  it('should render heading', () => {
    const blocks: any[] = [{ type: 'heading', text: 'Hello', level: 1 }];
    const html = renderBlocksToHtml(blocks);
    expect(html).toContain('<h1');
    expect(html).toContain('Hello');
  });

  it('should render paragraph', () => {
    const blocks: any[] = [{ type: 'paragraph', text: 'Body text' }];
    const html = renderBlocksToHtml(blocks);
    expect(html).toContain('<p');
    expect(html).toContain('Body text');
  });

  it('should render button', () => {
    const blocks: any[] = [{ type: 'button', text: 'Click', url: 'https://example.com', color: '#ff0000' }];
    const html = renderBlocksToHtml(blocks);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('Click');
  });

  it('should render divider', () => {
    const blocks: any[] = [{ type: 'divider' }];
    const html = renderBlocksToHtml(blocks);
    expect(html).toContain('<hr');
  });

  it('should render image', () => {
    const blocks: any[] = [{ type: 'image', src: 'https://img.jpg', alt: 'Image', width: 200 }];
    const html = renderBlocksToHtml(blocks);
    expect(html).toContain('src="https://img.jpg"');
    expect(html).toContain('width:200px;');
  });

  it('should render image without width', () => {
    const blocks: any[] = [{ type: 'image', src: 'https://img.jpg', alt: 'Image' }];
    const html = renderBlocksToHtml(blocks);
    expect(html).toContain('src="https://img.jpg"');
  });

  it('should render spacer', () => {
    const blocks: any[] = [{ type: 'spacer', height: 24 }];
    const html = renderBlocksToHtml(blocks);
    expect(html).toContain('height:24px');
  });

  it('should render multiple blocks', () => {
    const blocks: any[] = [
      { type: 'heading', text: 'Title', level: 2 },
      { type: 'paragraph', text: 'Content' },
    ];
    const html = renderBlocksToHtml(blocks);
    expect(html).toContain('Title');
    expect(html).toContain('Content');
  });
});
