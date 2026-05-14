import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface DeleteIntakeFormCommand {
  formId: string;
}

@Injectable()
export class DeleteIntakeFormHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute({ formId }: DeleteIntakeFormCommand): Promise<void> {
    const form = await this.prisma.intakeForm.findFirst({
      where: { id: formId },
      select: { id: true },
    });

    if (!form) {
      throw new NotFoundException('Intake form not found');
    }

    await this.prisma.intakeForm.delete({ where: { id: formId } });
  }
}
