import { BadRequestException, Injectable } from '@nestjs/common';
import { FileVisibility } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { UploadFileHandler } from '../../../media/files/upload-file.handler';
import { ownEmployee } from './self-profile.handler';
export const SELF_AVATAR_LIMIT = 1024 * 1024;
type Avatar = Pick<Express.Multer.File, 'originalname' | 'mimetype' | 'size' | 'buffer'>;
@Injectable()
export class ChangeSelfAvatarHandler {
  constructor(private readonly prisma: PrismaService, private readonly transactions: RlsTransactionService, private readonly upload: UploadFileHandler) {}
  async execute(userId: string, file: Avatar | null) {
    const { employee } = await ownEmployee(this.prisma, userId);
    let url: string | null = null;
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) || file.size > SELF_AVATAR_LIMIT) throw new BadRequestException('invalid_avatar');
      const uploaded = await this.upload.execute({ filename: file.originalname, mimetype: file.mimetype, size: file.size,
        ownerType: 'employee', ownerId: employee.id, uploadedBy: userId, visibility: FileVisibility.PUBLIC }, file.buffer);
      url = uploaded.url;
    }
    await this.transactions.withTransaction(async tx => {
      const current = await ownEmployee(tx, userId);
      if (current.employee.id !== employee.id) throw new BadRequestException('employee_profile_changed');
      await tx.employee.update({ where: { id: employee.id }, data: { avatarUrl: url, publicImageUrl: url } });
      await tx.user.update({ where: { id: userId }, data: { avatarUrl: url } });
    });
  }
}
