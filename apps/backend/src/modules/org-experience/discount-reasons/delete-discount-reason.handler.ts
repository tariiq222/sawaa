import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface DeleteDiscountReasonCommand {
  id: string;
}

@Injectable()
export class DeleteDiscountReasonHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ id }: DeleteDiscountReasonCommand) {
    const reason = await this.prisma.discountReason.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!reason) throw new NotFoundException('Discount reason not found');

    // Reason may already be referenced by historical invoices. Deleting it would
    // orphan that audit trail, so block hard-delete and steer to deactivation.
    const usedBy = await this.prisma.invoice.findFirst({
      where: { discountReasonId: id },
      select: { id: true },
    });
    if (usedBy) {
      throw new ConflictException(
        'This discount reason is referenced by existing invoices. Deactivate it instead of deleting.',
      );
    }

    await this.prisma.discountReason.delete({ where: { id } });
    return { id };
  }
}
