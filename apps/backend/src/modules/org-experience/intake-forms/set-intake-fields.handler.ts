import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { IntakeFieldInputDto } from './create-intake-form.dto';

export interface SetIntakeFieldsCommand {
  formId: string;
  fields: IntakeFieldInputDto[];
}

@Injectable()
export class SetIntakeFieldsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  /**
   * Atomically replace all fields on an intake form.
   * Deletes existing fields then bulk-inserts the new set inside a transaction.
   * Throws NotFoundException when the form does not exist.
   */
  async execute({ formId, fields }: SetIntakeFieldsCommand) {
    return this.rlsTransaction.withTransaction(async (tx) => {
      const form = await tx.intakeForm.findFirst({
        where: { id: formId },
        select: { id: true },
      });

      if (!form) {
        throw new NotFoundException('Intake form not found');
      }

      await tx.intakeField.deleteMany({ where: { formId } });

      if (fields.length > 0) {
        await tx.intakeField.createMany({
          data: fields.map((f, i) => ({
            formId,
            labelAr: f.labelAr,
            labelEn: f.labelEn,
            fieldType: f.fieldType,
            isRequired: f.isRequired ?? false,
            options: f.options ?? undefined,
            position: f.position ?? i,
          })),
        });
      }

      return tx.intakeForm.findUnique({
        where: { id: formId },
        include: { fields: { orderBy: { position: 'asc' } } },
      });
    });
  }
}
