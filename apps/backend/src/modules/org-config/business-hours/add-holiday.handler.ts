import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { AddHolidayDto } from './add-holiday.dto';

export type AddHolidayCommand = AddHolidayDto;

@Injectable()
export class AddHolidayHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: AddHolidayCommand) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const date = new Date(dto.date);
    const existing = await this.prisma.holiday.findUnique({
      where: { branchId_date: { branchId: dto.branchId, date } },
    });
    if (existing) throw new ConflictException('Holiday already exists for this date');

    return this.prisma.holiday.create({
      data: {
        branchId: dto.branchId,
        date,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
      },
    });
  }
}
