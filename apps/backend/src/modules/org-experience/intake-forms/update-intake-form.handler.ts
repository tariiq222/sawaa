import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface UpdateIntakeFormCommand {
  formId: string;
  nameAr?: string;
  nameEn?: string;
  isActive?: boolean;
}

@Injectable()
export class UpdateIntakeFormHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Update an existing intake form's metadata.
   * Throws NotFoundException when the form does not exist (Prisma P2025).
   */
  async execute({ formId, nameAr, nameEn, isActive }: UpdateIntakeFormCommand) {
    try {
      return await this.prisma.intakeForm.update({
        where: { id: formId },
        data: {
          ...(nameAr !== undefined && { nameAr }),
          ...(nameEn !== undefined && { nameEn }),
          ...(isActive !== undefined && { isActive }),
        },
        include: { fields: { orderBy: { position: 'asc' } } },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException('Intake form not found');
      }
      throw err;
    }
  }
}
