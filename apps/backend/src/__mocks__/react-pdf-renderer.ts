/**
 * CJS-compatible manual mock for the ESM-only `@react-pdf/renderer` package.
 *
 * The real package (and its transitive dep `yoga-layout`) is pure ESM and
 * uses `import.meta` / top-level await, which Jest's CommonJS VM cannot
 * load. We follow the same pattern used for `file-type` (see
 * `./file-type.ts`): the production code uses dynamic import (which Node 22
 * resolves via native `require(esm)`), while tests use this CJS shim
 * registered via `moduleNameMapper` in `jest.config.ts`.
 *
 * The mock returns a structurally valid PDF buffer so that handlers under
 * test can assert on the `%PDF` magic bytes, length, and content-type
 * propagation. It does NOT exercise real PDF layout — that is covered by
 * dedicated integration smoke tests run outside the Jest VM.
 */

import * as React from 'react';

/** Builds a minimal but structurally valid PDF buffer (>1KB). */
function buildStubPdf(): Buffer {
  // A tiny one-page PDF skeleton. We pad the body so the total length
  // exceeds 1024 bytes — that matches the threshold the renderer service
  // spec uses to confirm the buffer is "real PDF output".
  const header = '%PDF-1.4\n%âãÏÓ\n';
  const body = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >> endobj',
    // Padding comment to push the buffer past 1024 bytes deterministically.
    `% padding ${'.'.repeat(1100)}`,
  ].join('\n');
  const trailer = [
    'xref',
    '0 4',
    '0000000000 65535 f ',
    '0000000018 00000 n ',
    '0000000066 00000 n ',
    '0000000118 00000 n ',
    'trailer << /Size 4 /Root 1 0 R >>',
    'startxref',
    '200',
    '%%EOF',
  ].join('\n');
  return Buffer.from(`${header}${body}\n${trailer}\n`, 'binary');
}

interface PdfInstance {
  toBlob: () => Promise<Blob>;
  toBuffer: () => Promise<Buffer>;
}

/** Mirrors `@react-pdf/renderer`'s `pdf(element)` factory. */
export function pdf(_element: React.ReactElement): PdfInstance {
  const buffer = buildStubPdf();
  return {
    async toBlob() {
      // Node 18+ has global Blob; safe to use directly. Copy the buffer
      // into a fresh Uint8Array view so the BlobPart type matches across
      // ArrayBuffer / SharedArrayBuffer typings.
      const view = new Uint8Array(buffer);
      return new Blob([view], { type: 'application/pdf' });
    },
    async toBuffer() {
      return buffer;
    },
  };
}

// The template imports primitives from `@react-pdf/renderer` for use as
// React components. Returning lightweight pass-through components keeps the
// template's `React.createElement(...)` calls happy during test-time
// rendering of the React tree (which the mocked `pdf()` ignores anyway).
const passthrough = (name: string): React.FC<React.PropsWithChildren> =>
  function MockPdfPrimitive({ children }) {
    return React.createElement(React.Fragment, null, children);
  };

export const Document = passthrough('Document');
export const Page = passthrough('Page');
export const View = passthrough('View');
export const Text = passthrough('Text');
export const Image = passthrough('Image');

export const StyleSheet = {
  create<T extends Record<string, unknown>>(styles: T): T {
    return styles;
  },
};

export const Font = {
  register(_config: unknown): void {
    // no-op in tests
  },
};
