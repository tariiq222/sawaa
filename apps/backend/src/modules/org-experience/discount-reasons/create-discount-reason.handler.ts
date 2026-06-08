import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateDiscountReasonDto } from './discount-reason.dto';

export type CreateDiscountReasonCommand = CreateDiscountReasonDto;

@Injectable()
export class CreateDiscountReasonHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateDiscountReasonCommand) {
    const existing = await this.prisma.discountReason.findFirst({
      where: { labelAr: dto.labelAr },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A discount reason with this Arabic label already exists');
    }

    return this.prisma.discountReason.create({
      data: {
        labelAr: dto.labelAr,
        labelEn: dto.labelEn ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }
}
