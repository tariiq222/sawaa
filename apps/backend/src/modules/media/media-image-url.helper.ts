import { Logger } from '@nestjs/common';
import { MinioService } from '../../infrastructure/storage/minio.service';
import { extractMediaKey } from './media-key.helper';

// Short-lived presigned read window for media images surfaced to clients and
// the dashboard (D.1). The persisted value stays a bare object key; a fresh URL
// is minted on every read so links never outlive their signature.
export const MEDIA_IMAGE_URL_EXPIRY_SECONDS = 300;

const logger = new Logger('MediaImageUrl');

/**
 * Mints a short-lived presigned URL for a stored media `imageUrl`.
 *
 * The persisted value is a bare MinIO object key (legacy rows may hold a full
 * URL — normalised via `extractMediaKey`). Returns null when there is no image
 * so the response shape stays a nullable string. Shared by every read path
 * that surfaces a category/service image.
 */
export async function signMediaImageUrl(
  storage: MinioService,
  bucket: string,
  imageUrl: string | null,
): Promise<string | null> {
  if (!imageUrl) return null;
  const key = extractMediaKey(imageUrl, bucket);
  try {
    return await storage.getSignedUrl(bucket, key, MEDIA_IMAGE_URL_EXPIRY_SECONDS);
  } catch {
    // One broken image must not reject an entire Promise.all read response.
    // Never log the stored URL or signer error: either may contain signatures
    // or credentials. Only the bucket and signature-free object key are safe.
    logger.warn('Failed to sign media image URL', { bucket, key: key.split(/[?#]/, 1)[0] });
    return null;
  }
}
