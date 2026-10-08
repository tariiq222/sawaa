import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database';
import { MinioService } from '../../infrastructure/storage/minio.service';
import { extractMediaKey } from './media-key.helper';
import { MEDIA_IMAGE_URL_EXPIRY_SECONDS } from './media-image-url.helper';

@Injectable()
export class OwnedImageResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MinioService,
    private readonly config: ConfigService,
  ) {}

  async resolve(ownerType: string, ownerId: string, value: string | null | undefined): Promise<string | null> {
    if (!value || value.startsWith('blob:')) return null;
    const bucket = this.config.get<string>('MINIO_BUCKET', 'deqah-v2');
    const key = extractMediaKey(value, bucket);
    // The field alone never authorizes access to another private object.
    const file = await this.prisma.file.findFirst({
      where: {
        bucket, storageKey: key, ownerType, ownerId,
        mimetype: { in: ['image/jpeg', 'image/png', 'image/webp'] },
      },
      select: { storageKey: true, bucket: true },
    });
    if (file) {
      return this.storage.getSignedUrl(file.bucket, file.storageKey, MEDIA_IMAGE_URL_EXPIRY_SECONDS);
    }
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        if (url.hostname === 'minio' || url.pathname.startsWith(`/${bucket}/`)) return null;
      } catch {
        return null;
      }
    }
    return /^(https?:\/\/|\/)/i.test(value) ? value : null;
  }
}
