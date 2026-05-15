import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { UploadFileHandler } from '../../../media/files/upload-file.handler';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_MIMETYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export type UploadLogoCommand = {
  filename: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class UploadLogoHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadFile: UploadFileHandler,
  ) {}

  async execute(cmd: UploadLogoCommand, buffer: Buffer): Promise<{ fileId: string; url: string }> {
    if (!ALLOWED_LOGO_MIMETYPES.has(cmd.mimetype)) {
      throw new BadRequestException(`Logo mimetype not allowed: ${cmd.mimetype}`);
    }
    if (cmd.size > MAX_LOGO_BYTES) {
      throw new BadRequestException(`Logo exceeds maximum size of ${MAX_LOGO_BYTES} bytes`);
    }

    const file = await this.uploadFile.execute(
      {
        filename: cmd.filename,
        mimetype: cmd.mimetype,
        size: cmd.size,
        ownerType: 'branding',
      },
      buffer,
    );

    const existing = await this.prisma.brandingConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      await this.prisma.brandingConfig.update({
        where: { id: existing.id },
        data: { logoUrl: file.url },
      });
    } else {
      await this.prisma.brandingConfig.create({
        data: { organizationNameAr: 'منظمتي', logoUrl: file.url },
      });
    }

    return { fileId: file.id, url: file.url };
  }
}
