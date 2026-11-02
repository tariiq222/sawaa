import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { File, FileVisibility } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { EventBusService } from '../../../infrastructure/events';
import { FileUploadedEvent } from '../events/file-uploaded.event';
import { UploadFileDto } from './upload-file.dto';
import { validateMagicBytes } from '../../../common/security/magic-byte-validator';
import { DEFAULT_ORG_ID } from '../../../common/constants';

// Shared HTTP/handler policy: current generic-media callers upload catalog,
// package/family and mobile-home-card images only (the last accepts GIF too).
// No document/CSV/XLSX intake or attachment upload uses this endpoint; bank
// receipts have their own policy. Keep the existing 10 MiB HTTP ceiling rather
// than expanding it to 25 MiB. This also lowers the shared employee transport
// ceiling; its UI (5 MiB) and self-avatar (1 MiB) limits remain stricter.
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MEDIA_MIME_TYPES: readonly string[] = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export type UploadFileCommand = UploadFileDto & {
  filename: string;
  mimetype: string;
  size: number;
  uploadedBy?: string;
};

@Injectable()
export class UploadFileHandler {
  private readonly logger = new Logger(UploadFileHandler.name);
  private readonly defaultBucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MinioService,
    private readonly eventBus: EventBusService,
    config: ConfigService,
  ) {
    this.defaultBucket = config.getOrThrow<string>('MINIO_BUCKET');
  }

  async execute(cmd: UploadFileCommand, buffer: Buffer): Promise<File & { url: string }> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Empty file buffer');
    }
    if (buffer.length !== cmd.size) {
      throw new BadRequestException('Declared size does not match buffer length');
    }
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(`File exceeds maximum size of ${MAX_FILE_SIZE_BYTES} bytes`);
    }
    if (!ALLOWED_MEDIA_MIME_TYPES.includes(cmd.mimetype)) {
      throw new BadRequestException(`Mime type not allowed: ${cmd.mimetype}`);
    }

    const check = await validateMagicBytes(buffer, cmd.mimetype, ALLOWED_MEDIA_MIME_TYPES);
    if (!check.ok) {
      throw new BadRequestException(
        `File content validation failed: ${check.reason ?? 'content does not match declared type'}`,
      );
    }

    const ext = extname(cmd.filename).toLowerCase();
    const safeFilename = cmd.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const organizationId = DEFAULT_ORG_ID;
    const storageKey = `${organizationId}/${randomUUID()}${ext}`;

    const url = await this.storage.uploadFile(this.defaultBucket, storageKey, buffer, cmd.mimetype);

    let file: File;
    try {
      file = await this.prisma.file.create({
        data: {
          bucket: this.defaultBucket,
          storageKey,
          filename: safeFilename,
          mimetype: cmd.mimetype,
          size: cmd.size,
          visibility: cmd.visibility ?? FileVisibility.PRIVATE,
          ownerType: cmd.ownerType,
          ownerId: cmd.ownerId,
          uploadedBy: cmd.uploadedBy,
        },
      });
    } catch (err) {
      await this.storage
        .deleteFile(this.defaultBucket, storageKey)
        .catch(() => undefined);
      throw err;
    }

    const event = new FileUploadedEvent({
      fileId: file.id,
      organizationId,
      sizeBytes: file.size,
    });
    this.eventBus.publish(event.eventName, event.toEnvelope()).catch((err) =>
      this.logger.error(
        'Failed to publish media.file.uploaded',
        err instanceof Error ? err.stack : undefined,
      ),
    );

    return Object.assign(file, { url });
  }
}
