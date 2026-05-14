import type { EmailBlock } from './email-block.types';

/**
 * Escape HTML special characters EXCEPT curly braces so that Handlebars
 * variables ({{varName}}) pass through untouched to the mailer interpolation
 * step.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render an array of EmailBlocks into email-safe HTML.
 * The outer wrapper mimics a simple email layout (max-width 560px, centered).
 * Each block type maps to a minimal inline-styled HTML element.
 */
export function renderBlocksToHtml(blocks: EmailBlock[]): string {
  const inner = blocks.map((block) => renderBlock(block)).join('\n');
  return [
    '<div style="font-family:\'IBM Plex Sans Arabic\',system-ui;padding:24px;max-width:560px;margin:0 auto;">',
    inner,
    '</div>',
  ].join('\n');
}

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case 'heading': {
      const tag = `h${block.level}`;
      return `<${tag} style="color:#354FD8;margin:16px 0 8px;">${escapeHtml(block.text)}</${tag}>`;
    }
    case 'paragraph':
      return `<p style="margin:8px 0;line-height:1.6;color:#1f2937;">${escapeHtml(block.text)}</p>`;
    case 'button': {
      const bg = escapeHtml(block.color ?? '#354FD8');
      return `<p style="margin:24px 0;"><a href="${escapeHtml(block.url)}" style="background:${bg};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">${escapeHtml(block.text)}</a></p>`;
    }
    case 'divider':
      return `<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0;">`;
    case 'image': {
      const widthStyle = block.width ? `width:${block.width}px;` : '';
      return `<p style="margin:16px 0;"><img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" style="max-width:100%;${widthStyle}height:auto;border:0;display:block;" /></p>`;
    }
    case 'spacer':
      return `<div style="height:${block.height}px;line-height:${block.height}px;">&nbsp;</div>`;
  }
}
