import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileVisibility } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { MinioService } from '../../../../infrastructure/storage/minio.service';
import { ownEmployee } from './self-profile.handler';
import { employeeAvatarUrl } from './employee-avatar-url';

@Injectable()
export class PublicEmployeeAvatarHandler {
  constructor(private readonly prisma: PrismaService, private readonly storage: MinioService, private readonly config: ConfigService) {}
  async execute(fileId: string) {
    const file = await this.prisma.file.findFirst({ where: { id: fileId, visibility: FileVisibility.PUBLIC, ownerType: 'employee', isDeleted: false } });
    if (!file?.uploadedBy || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new NotFoundException();
    const owner = await ownEmployee(this.prisma, file.uploadedBy).catch(error => {
      if (error instanceof ForbiddenException) throw new NotFoundException();
      throw error;
    });
    const expectedUrl = employeeAvatarUrl(this.config.get<string>('API_PUBLIC_URL'), file.id);
    if (owner.employee.id !== file.ownerId || owner.employee.publicImageUrl !== expectedUrl || owner.employee.avatarUrl !== expectedUrl) throw new NotFoundException();
    // Only the currently displayed, explicitly public photo is readable. Old
    // links stop resolving immediately after replacement or removal.
    const stream = await this.storage.getFileStream(file.bucket, file.storageKey).catch(error => {
      if (error?.code === 'NoSuchKey' || error?.code === 'NotFound') throw new NotFoundException();
      throw error;
    });
    return { stream, mimetype: file.mimetype, size: file.size };
  }
}
