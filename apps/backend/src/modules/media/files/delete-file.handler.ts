import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';

@Injectable()
export class DeleteFileHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MinioService,
  ) {}

  async execute(fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, isDeleted: false },
    });
    if (!file) throw new NotFoundException('File not found');

    await this.storage.deleteFile(file.bucket, file.storageKey);

    return this.prisma.file.update({
      where: { id: file.id },
      data: { isDeleted: true },
    });
  }
}
