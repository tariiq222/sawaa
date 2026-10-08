import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { extractMediaKey } from '../media-key.helper';
import { MEDIA_IMAGE_URL_EXPIRY_SECONDS } from '../media-image-url.helper';

@Injectable()
export class ResolveEmployeeImageHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MinioService,
    private readonly config: ConfigService,
  ) {}

  async execute(query: { employeeId: string; reference: string | null | undefined; format?: 'key' }): Promise<string | null> {
    if (!query.reference) return null;
    const bucket = this.config.getOrThrow<string>('MINIO_BUCKET');
    const key = extractMediaKey(query.reference, bucket);
    // Match the selected image only, never an arbitrary file or another staff member's upload.
    const file = await this.prisma.file.findFirst({
      where: {
        ownerType: 'employee', ownerId: query.employeeId, bucket,
        mimetype: { in: ['image/jpeg', 'image/png', 'image/webp'] },
        OR: [{ storageKey: key }, { filename: query.reference }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { bucket: true, storageKey: true, isDeleted: true },
    });
    // A deleted latest upload must not resurrect an older object with the same filename.
    if (file?.isDeleted) return null;
    if (file && query.format === 'key') return file.storageKey;
    if (file) return this.storage.getSignedUrl(file.bucket, file.storageKey, MEDIA_IMAGE_URL_EXPIRY_SECONDS);

    // Keep manually selected external portraits, but never leak a raw private storage URL.
    if (query.reference.startsWith('/') && !query.reference.startsWith('//')) return query.reference;
    try {
      const url = new URL(query.reference);
      const storageHosts = ['minio', this.config.get<string>('MINIO_ENDPOINT'), this.config.get<string>('MINIO_PUBLIC_ENDPOINT')];
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !storageHosts.includes(url.hostname)) return url.href;
    } catch { /* A missing legacy filename has no usable public URL. */ }
    return null;
  }
}
