import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class GetFileHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, isDeleted: false },
    });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }
}
