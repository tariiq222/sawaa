import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { GeneratePresignedUrlDto } from './generate-presigned-url.dto';

const DEFAULT_EXPIRY_SECONDS = 3600;

export type GeneratePresignedUrlQuery = GeneratePresignedUrlDto & {
  fileId: string;
  userId?: string;
};

@Injectable()
export class GeneratePresignedUrlHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MinioService,
  ) {}

  async execute(query: GeneratePresignedUrlQuery) {
    const file = await this.prisma.file.findFirst({
      where: { id: query.fileId, isDeleted: false },
    });
    if (!file) throw new NotFoundException('File not found');

    // Ownership / visibility gate.
    // - PUBLIC files: always accessible.
    // - PRIVATE files: only the uploader or a super-admin may mint a URL.
    //   Without this check, any caller with `read:Setting` could exfiltrate
    //   any private File.id (e.g. sensitive client documents).
    if (file.visibility !== 'PUBLIC') {
      const isUploader = !!query.userId && file.uploadedBy === query.userId;
      let isSuperAdmin = false;
      if (!isUploader && query.userId) {
        const u = await this.prisma.user.findUnique({
          where: { id: query.userId },
          select: { isSuperAdmin: true },
        });
        isSuperAdmin = u?.isSuperAdmin === true;
      }
      if (!isUploader && !isSuperAdmin) {
        throw new ForbiddenException('Not allowed to access this file');
      }
    }

    const expiry = query.expirySeconds ?? DEFAULT_EXPIRY_SECONDS;
    const url = await this.storage.getSignedUrl(file.bucket, file.storageKey, expiry);

    return {
      fileId: file.id,
      url,
      expiresInSeconds: expiry,
      filename: file.filename,
      mimetype: file.mimetype,
    };
  }
}
