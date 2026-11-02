import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { extractMediaKey } from '../media-key.helper';
import { MEDIA_IMAGE_URL_EXPIRY_SECONDS } from '../media-image-url.helper';

/** Only these formats may be surfaced as an employee portrait. */
export const EMPLOYEE_IMAGE_MIMETYPES: string[] = ['image/jpeg', 'image/png', 'image/webp'];

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
        mimetype: { in: EMPLOYEE_IMAGE_MIMETYPES },
        OR: [{ storageKey: key }, { filename: query.reference }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { bucket: true, storageKey: true, isDeleted: true },
    });
    // A deleted latest upload must not resurrect an older object with the same filename.
    if (file?.isDeleted) return null;
    if (file && query.format === 'key') return file.storageKey;
    if (file) return this.storage.getSignedUrl(file.bucket, file.storageKey, MEDIA_IMAGE_URL_EXPIRY_SECONDS);

    // Manual portraits (root-relative or an external CDN) are served as stored;
    // the storage host itself is never handed out raw because its bucket is private.
    const manual = this.manualPortrait(query.reference);
    if (manual) return manual;

    // Imported portraits can predate the file ledger: the object sits in the bucket
    // while no File row records it, so the lookup above misses it and the public
    // portrait answers 404. Sign such an object only when it exists and nobody else
    // owns the key — the employee record alone must never expose another staff
    // member's private upload.
    return this.resolveUnclaimedObject(query.employeeId, bucket, key, query.format);
  }

  /** A usable non-storage value, or null when the reference points at private storage. */
  private manualPortrait(reference: string): string | null {
    if (reference.startsWith('/') && !reference.startsWith('//')) return reference;
    try {
      const url = new URL(reference);
      const storageHosts = ['minio', this.config.get<string>('MINIO_ENDPOINT'), this.config.get<string>('MINIO_PUBLIC_ENDPOINT')];
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !storageHosts.includes(url.hostname)) return url.href;
    } catch { /* A missing legacy filename has no usable public URL. */ }
    return null;
  }

  private async resolveUnclaimedObject(
    employeeId: string,
    bucket: string,
    key: string,
    format: 'key' | undefined,
  ): Promise<string | null> {
    // A root-relative or dotted value is an application path, not a storage key.
    if (!key || key.startsWith('/') || key.startsWith('.')) return null;
    const claimedByAnother = await this.prisma.file.findFirst({
      where: {
        storageKey: key,
        NOT: { ownerType: 'employee', ownerId: employeeId },
      },
      select: { id: true },
    });
    if (claimedByAnother) return null;
    if (!(await this.storage.fileExists(bucket, key))) return null;
    return format === 'key' ? key : this.storage.getSignedUrl(bucket, key, MEDIA_IMAGE_URL_EXPIRY_SECONDS);
  }
}
