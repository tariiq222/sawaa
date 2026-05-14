import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

@Injectable()
export class DeleteFileHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MinioService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(fileId: string) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, isDeleted: false, organizationId },
    });
    if (!file) throw new NotFoundException('File not found');

    await this.storage.deleteFile(file.bucket, file.storageKey);

    return this.prisma.file.update({
      where: { id: file.id },
      data: { isDeleted: true },
    });
  }
}
