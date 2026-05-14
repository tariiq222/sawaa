import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { UploadFileHandler } from '../../../media/files/upload-file.handler';

export const MAX_AVATAR_BYTES = 1 * 1024 * 1024;
export const ALLOWED_AVATAR_MIMETYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export type UploadAvatarCommand = {
  employeeId: string;
  filename: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class UploadAvatarHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadFile: UploadFileHandler,
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
      select: { id: true },
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

    const { url } = file;

    await this.prisma.employee.update({
      where: { id: cmd.employeeId },
      data: { avatarUrl: url },
    });

    return { fileId: file.id, url };
  }
}
