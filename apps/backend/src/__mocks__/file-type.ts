/**
 * CJS-compatible manual mock for the ESM-only `file-type@22` package.
 *
 * Jest cannot load the real ESM module in a CommonJS test environment.
 * This mock replaces it via `moduleNameMapper` in jest.config.ts.
 *
 * The real implementation is detected by magic bytes. This mock provides
 * a thin, deterministic version of the same logic covering the file types
 * used in upload handlers (JPEG, PNG, WebP, GIF, PDF, DOCX, XLSX, MP4).
 *
 * Tests that need to exercise specific detection scenarios can override
 * the mock per-test with jest.mock / jest.spyOn on this module.
 */

interface FileTypeResult {
  mime: string;
  ext: string;
}

/**
 * Lightweight magic-byte sniffer covering all MIME types in the upload allow-lists.
 * Mirrors the detection logic of file-type@22 for the types we care about.
 */
export async function fileTypeFromBuffer(
  buffer: Buffer | Uint8Array,
): Promise<FileTypeResult | undefined> {
  const b = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' };
  }

  // WebP: RIFF????WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }

  // GIF: GIF87a or GIF89a
  if (
    b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61
  ) {
    return { mime: 'image/gif', ext: 'gif' };
  }

  // PDF: %PDF-
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) {
    return { mime: 'application/pdf', ext: 'pdf' };
  }

  // DOCX / XLSX (ZIP-based Office): PK\x03\x04
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    // We can't distinguish DOCX from XLSX without inspecting inner entries,
    // so return a generic Office OOXML mime. Callers should not rely on
    // discriminating DOCX vs XLSX via magic bytes alone.
    return {
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ext: 'docx',
    };
  }

  // MP4: ftyp box at offset 4
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    return { mime: 'video/mp4', ext: 'mp4' };
  }

  return undefined;
}
