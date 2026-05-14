import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

@Injectable()
export class GetFileHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(fileId: string) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, isDeleted: false, organizationId },
    });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }
}
