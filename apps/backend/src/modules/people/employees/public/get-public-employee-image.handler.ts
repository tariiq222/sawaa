import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { ResolveEmployeeImageHandler } from '../../../media/files/resolve-employee-image.handler';

@Injectable()
export class GetPublicEmployeeImageHandler {
  constructor(private readonly prisma: PrismaService, private readonly images: ResolveEmployeeImageHandler) {}

  async execute(key: string): Promise<string> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
    const employee = await this.prisma.employee.findFirst({
      where: { ...(isUuid ? { id: key } : { slug: key }), isPublic: true, isActive: true },
      select: { id: true, publicImageUrl: true },
    });
    if (!employee) throw new NotFoundException('Employee image not found');
    const url = await this.images.execute({ employeeId: employee.id, reference: employee.publicImageUrl });
    if (!url) throw new NotFoundException('Employee image not found');
    return url;
  }
}
