import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { IntakeFormScope, IntakeFormType, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { IntakeFieldInputDto } from './create-intake-form.dto';
import { fieldsSemanticallyEqual, mapIntakeFormResult, validateIntakeFormScope } from './intake-form.helpers';

export interface UpdateIntakeFormCommand {
  formId: string;
  nameAr?: string;
  nameEn?: string | null;
  isActive?: boolean;
  type?: IntakeFormType;
  scope?: IntakeFormScope;
  scopeId?: string | null;
  fields?: IntakeFieldInputDto[];
}

@Injectable()
export class UpdateIntakeFormHandler {
  constructor(
    _prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(command: UpdateIntakeFormCommand) {
    try {
      return await this.rlsTransaction.withTransaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "IntakeForm" WHERE id = ${command.formId} FOR UPDATE`;

        const current = await tx.intakeForm.findUnique({
          where: { id: command.formId },
          include: {
            fields: { orderBy: { position: 'asc' } },
            _count: {
              select: {
                responses: { where: { supersededAt: null } },
              },
            },
          },
        });
        if (!current) throw new NotFoundException('Intake form not found');

        const nextScope = command.scope ?? current.scope;
        const scopeWasPatched = command.scope !== undefined || command.scopeId !== undefined;
        const scopeChanged = command.scope !== undefined && command.scope !== current.scope;
        const requestedScopeId = command.scopeId !== undefined
          ? command.scopeId
          : scopeChanged
            ? undefined
            : current.scopeId;
        const nextScopeId = scopeWasPatched
          ? await validateIntakeFormScope(tx, nextScope, requestedScopeId)
          : current.scopeId;

        const fieldsChanged = command.fields !== undefined &&
          !fieldsSemanticallyEqual(current.fields, command.fields);
        if (fieldsChanged) {
          // Keep the field lock conservative: historical rows also protect
          // field IDs even after they are superseded.
          const totalResponses = await tx.intakeResponse.count({
            where: { formId: command.formId },
          });
          if (totalResponses > 0) {
            throw new ConflictException('Answered intake forms cannot change their fields');
          }
        }

        const data: Prisma.IntakeFormUpdateInput = {
          ...(command.nameAr !== undefined && { nameAr: command.nameAr }),
          ...(command.nameEn !== undefined && { nameEn: command.nameEn }),
          ...(command.isActive !== undefined && { isActive: command.isActive }),
          ...(command.type !== undefined && { type: command.type }),
          ...((command.scope !== undefined || command.scopeId !== undefined) && {
            scope: nextScope,
            scopeId: nextScopeId,
          }),
        };

        if (Object.keys(data).length > 0) {
          await tx.intakeForm.update({
            where: { id: command.formId },
            data,
          });
        }

        if (fieldsChanged) {
          await tx.intakeField.deleteMany({ where: { formId: command.formId } });
          if (command.fields && command.fields.length > 0) {
            await tx.intakeField.createMany({
              data: command.fields.map((field, index) => ({
                formId: command.formId,
                labelAr: field.labelAr,
                labelEn: field.labelEn,
                fieldType: field.fieldType,
                isRequired: field.isRequired ?? false,
                options: field.options ?? undefined,
                position: field.position ?? index,
              })),
            });
          }
        }

        const updated = fieldsChanged || Object.keys(data).length > 0
          ? await tx.intakeForm.findUnique({
              where: { id: command.formId },
              include: {
                fields: { orderBy: { position: 'asc' } },
                _count: {
                  select: {
                    responses: { where: { supersededAt: null } },
                  },
                },
              },
            })
          : current;

        if (!updated) throw new NotFoundException('Intake form not found');
        return mapIntakeFormResult(updated);
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
