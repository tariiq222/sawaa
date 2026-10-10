import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class GetDepartmentHandler {
  constructor(private readonly prisma: PrismaService) {}
  async execute({ departmentId }: { departmentId: string }) {
    const item = await this.prisma.department.findFirst({ where: { id: departmentId } });
    if (!item) throw new NotFoundException('Department not found');
    return item;
  }
}
