import { ResolveEmployeeImageHandler } from '../../../media/files/resolve-employee-image.handler';
import { MinioService } from '../../../../infrastructure/storage/minio.service';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { MEDIA_IMAGE_URL_EXPIRY_SECONDS } from '../../../media/media-image-url.helper';
import { PrismaService } from '../../../../infrastructure/database';
import { UploadFileHandler } from '../../../media/files/upload-file.handler';

const MAX_AVATAR_BYTES = 1 * 1024 * 1024;
const ALLOWED_AVATAR_MIMETYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export type UploadAvatarCommand = {
  employeeId: string;
  target?: 'avatar' | 'public';
  filename: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class UploadAvatarHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadFile: UploadFileHandler,
    private readonly storage: MinioService,
    private readonly images: ResolveEmployeeImageHandler,
  ) {}

  async execute(
    cmd: UploadAvatarCommand,
    buffer: Buffer,
  ): Promise<{ fileId: string; url: string }> {
    if (!ALLOWED_AVATAR_MIMETYPES.has(cmd.mimetype)) {
      throw new BadRequestException(`Avatar mimetype not allowed: ${cmd.mimetype}`);
    }
    if (cmd.size > MAX_AVATAR_BYTES) {
      throw new BadRequestException(
        `Avatar exceeds maximum size of ${MAX_AVATAR_BYTES} bytes`,
      );
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: cmd.employeeId },
      select: { id: true, avatarUrl: true, publicImageUrl: true },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${cmd.employeeId} not found`);
    }

    const file = await this.uploadFile.execute(
      {
        filename: cmd.filename,
        mimetype: cmd.mimetype,
        size: cmd.size,
        ownerType: 'employee',
        ownerId: cmd.employeeId,
      } as never,
      buffer,
    );

    const [previousAvatar, previousPublic] = await Promise.all([
      this.images.execute({ employeeId: employee.id, reference: employee.avatarUrl, format: 'key' }),
      this.images.execute({ employeeId: employee.id, reference: employee.publicImageUrl, format: 'key' }),
    ]);
    const followsAvatar = !employee.publicImageUrl || employee.publicImageUrl === employee.avatarUrl
      || (!!previousAvatar && previousAvatar === previousPublic)
      || employee.publicImageUrl === cmd.filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    await this.prisma.employee.update({
      where: { id: cmd.employeeId },
      data: cmd.target === 'public'
        ? { publicImageUrl: file.storageKey }
        : {
            avatarUrl: file.storageKey,
            ...(followsAvatar ? { publicImageUrl: file.storageKey } : {}),
          },
    });

    const url = await this.storage.getSignedUrl(file.bucket, file.storageKey, 300);
    return { fileId: file.id, url };
  }
}
