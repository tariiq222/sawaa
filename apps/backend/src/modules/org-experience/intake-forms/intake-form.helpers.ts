import { BadRequestException } from '@nestjs/common';
import { IntakeFormScope } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

type ScopeLookupClient = Pick<PrismaService, 'service' | 'employee' | 'branch'>;

export async function validateIntakeFormScope(
  db: ScopeLookupClient,
  scope: IntakeFormScope,
  scopeId: string | null | undefined,
): Promise<string | null> {
  if (scope === IntakeFormScope.GLOBAL) return null;
  if (!scopeId) {
    throw new BadRequestException(`scopeId is required for ${scope} intake forms`);
  }

  const target = scope === IntakeFormScope.SERVICE
    ? await db.service.findUnique({ where: { id: scopeId }, select: { id: true } })
    : scope === IntakeFormScope.EMPLOYEE
      ? await db.employee.findUnique({ where: { id: scopeId }, select: { id: true } })
      : await db.branch.findUnique({ where: { id: scopeId }, select: { id: true } });

  if (!target) {
    throw new BadRequestException(`Invalid ${scope.toLowerCase()} scopeId`);
  }
  return scopeId;
}

type FieldLike = {
  labelAr: string;
  labelEn?: string | null;
  fieldType: string;
  isRequired?: boolean | null;
  options?: unknown;
  position?: number | null;
};

function normalizeOptions(options: unknown): string[] | null {
  if (options === null || options === undefined) return null;
  if (!Array.isArray(options) || options.length === 0) return null;
  return options.map(String);
}

export function fieldsSemanticallyEqual(
  current: FieldLike[] = [],
  replacement: FieldLike[] = [],
): boolean {
  if (current.length !== replacement.length) return false;

  const canonicalize = (fields: FieldLike[]) => fields
    .map((field, index) => ({ field, position: field.position ?? index }))
    .sort((a, b) => a.position - b.position)
    .map(({ field }) => ({
      labelAr: field.labelAr,
      labelEn: field.labelEn?.trim() || null,
      fieldType: field.fieldType,
      isRequired: field.isRequired ?? false,
      options: normalizeOptions(field.options),
    }));

  return JSON.stringify(canonicalize(current)) === JSON.stringify(canonicalize(replacement));
}

export function mapIntakeFormResult<T extends { _count: { responses: number } }>(form: T) {
  const { _count, ...withoutCount } = form;
  return {
    ...withoutCount,
    submissionsCount: _count.responses,
  };
}
