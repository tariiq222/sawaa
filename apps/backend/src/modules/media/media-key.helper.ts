/**
 * Media objects (category/service images, etc.) live in the MinIO bucket named
 * by the `MINIO_BUCKET` config value, under keys shaped like
 * `<orgId>/<uuid>.<ext>` (see upload-file.handler.ts). As of D.1 the consuming
 * rows (e.g. `ServiceCategory.imageUrl`) store the bare object KEY, and read
 * endpoints mint short-lived presigned URLs on demand — never persisting a
 * presigned URL, which expires (~15 min) and then 403s.
 *
 * Older rows may still hold a full `http(s)://host/<bucket>/<key>` URL — or a
 * presigned URL with a `?X-Amz-...` query string — persisted before the fix.
 * `extractMediaKey` normalises any of those forms back to the bare object key
 * so a fresh presigned URL can be generated for both new and legacy rows.
 */

/**
 * Returns the MinIO object key for a media asset given whatever is stored
 * (e.g. in `ServiceCategory.imageUrl`).
 *
 * - New rows store the bare key (`<orgId>/<uuid>.<ext>`) and are returned
 *   unchanged.
 * - Legacy rows store a full URL; the scheme+host is stripped, the leading
 *   `<bucket>/` segment is removed, and any `?querystring` (presigned
 *   signature params) is discarded, leaving only the object key.
 *
 * The media bucket name is not a fixed literal (it comes from `MINIO_BUCKET`),
 * so it is passed in to recognise the bucket segment in legacy URLs.
 */
export function extractMediaKey(stored: string, bucket: string): string {
  // Already a bare key — no scheme to strip.
  if (!/^https?:\/\//i.test(stored)) {
    return stored;
  }

  let pathname: string;
  try {
    // Drops scheme, host, port and any `?X-Amz-...` query string.
    pathname = new URL(stored).pathname;
  } catch {
    return stored;
  }

  // Strip a leading slash, then an optional leading `<bucket>/` segment.
  let key = pathname.replace(/^\/+/, '');
  const bucketPrefix = `${bucket}/`;
  if (key.startsWith(bucketPrefix)) {
    key = key.slice(bucketPrefix.length);
  }
  return key;
}
