import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateDiscountReasonDto } from './discount-reason.dto';

export type UpdateDiscountReasonCommand = UpdateDiscountReasonDto & { id: string };

@Injectable()
export class UpdateDiscountReasonHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ id, ...dto }: UpdateDiscountReasonCommand) {
    const reason = await this.prisma.discountReason.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!reason) throw new NotFoundException('Discount reason not found');

    if (dto.labelAr !== undefined) {
      const clash = await this.prisma.discountReason.findFirst({
        where: { labelAr: dto.labelAr, id: { not: id } },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException('A discount reason with this Arabic label already exists');
      }
    }

    return this.prisma.discountReason.update({
      where: { id },
      data: {
        ...(dto.labelAr !== undefined && { labelAr: dto.labelAr }),
        ...(dto.labelEn !== undefined && { labelEn: dto.labelEn }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }
}
