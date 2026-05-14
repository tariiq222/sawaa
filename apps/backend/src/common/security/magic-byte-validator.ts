export interface MagicByteCheckResult {
  ok: boolean;
  detectedMime: string | null;
  reason?: string;
}

/**
 * Validate a file buffer's actual content type by magic bytes.
 * Rejects when:
 *  - file-type cannot detect a type AND claimedMime is not in textWhitelist
 *    (plain-text/csv have no magic bytes)
 *  - detected mime is not in allowedMimes
 *  - detected mime differs from claimedMime (when both detected and claimed are present)
 *
 * file-type@22 is ESM-only — uses dynamic import.
 */
export async function validateMagicBytes(
  buffer: Buffer,
  claimedMime: string,
  allowedMimes: readonly string[],
  options?: { textMimes?: readonly string[] },
): Promise<MagicByteCheckResult> {
  const textMimes = options?.textMimes ?? ['text/plain', 'text/csv'];
  const { fileTypeFromBuffer } = await import('file-type');
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    // file-type returns undefined for plain-text formats (txt, csv) — they have no magic bytes.
    // Only accept them when the claimed mime is in the text whitelist AND in allowedMimes.
    if (textMimes.includes(claimedMime) && allowedMimes.includes(claimedMime)) {
      return { ok: true, detectedMime: null };
    }
    return {
      ok: false,
      detectedMime: null,
      reason: 'unable to detect file type from content',
    };
  }

  if (!allowedMimes.includes(detected.mime)) {
    return {
      ok: false,
      detectedMime: detected.mime,
      reason: `detected mime ${detected.mime} not in allow-list`,
    };
  }

  // If client claimed a specific mime and it differs from detected, reject.
  if (claimedMime && claimedMime !== detected.mime) {
    return {
      ok: false,
      detectedMime: detected.mime,
      reason: `claimed mime ${claimedMime} does not match detected ${detected.mime}`,
    };
  }

  return { ok: true, detectedMime: detected.mime };
}
