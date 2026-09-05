import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { IntakeFieldInputDto } from './create-intake-form.dto';
import { fieldsSemanticallyEqual, mapIntakeFormResult } from './intake-form.helpers';

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
      await tx.$queryRaw`SELECT id FROM "IntakeForm" WHERE id = ${formId} FOR UPDATE`;

      const form = await tx.intakeForm.findFirst({
        where: { id: formId },
        include: {
          fields: { orderBy: { position: 'asc' } },
          _count: {
            select: {
              responses: { where: { supersededAt: null } },
            },
          },
        },
      });

      if (!form) {
        throw new NotFoundException('Intake form not found');
      }

      if (fieldsSemanticallyEqual(form.fields, fields)) {
        return mapIntakeFormResult(form);
      }
      // Historical rows also protect field IDs after being superseded, so the
      // mutation guard intentionally counts every response row.
      const totalResponses = await tx.intakeResponse.count({ where: { formId } });
      if (totalResponses > 0) {
        throw new ConflictException('Answered intake forms cannot change their fields');
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

      const updated = await tx.intakeForm.findUnique({
        where: { id: formId },
        include: {
          fields: { orderBy: { position: 'asc' } },
          _count: {
            select: {
              responses: { where: { supersededAt: null } },
            },
          },
        },
      });
      if (!updated) throw new NotFoundException('Intake form not found');
      return mapIntakeFormResult(updated);
    });
  }
}
