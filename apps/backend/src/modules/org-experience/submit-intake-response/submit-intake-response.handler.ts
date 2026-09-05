import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { areIntakeAnswersEqual, toIntakeRevisionData } from '../../../common/database/intake-response-history.helper';

export interface SubmitIntakeResponseCommand {
  bookingId: string;
  formId: string;
  answers: Record<string, string | string[]>;
  /**
   * Identity of the client submitting. When provided (client-facing path), the
   * booking must belong to this client. Omitted for staff "submit on behalf".
   */
  clientId?: string;
}

const OPTION_FIELD_TYPES = new Set(['SELECT', 'RADIO', 'CHECKBOX']);

function isNonEmpty(value: string | string[] | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0 && value.every((v) => typeof v === 'string' && v.trim() !== '');
  return typeof value === 'string' && value.trim() !== '';
}

function validateAnswers(
  form: { fields: Array<{ id: string; labelAr: string; fieldType: string; isRequired: boolean; options: unknown }> },
  answers: Record<string, string | string[]>,
): void {
  const fieldsById = new Map(form.fields.map((f) => [f.id, f]));

  for (const fieldId of Object.keys(answers)) {
    if (!fieldsById.has(fieldId)) {
      throw new BadRequestException(`Answer references unknown field "${fieldId}"`);
    }
  }

  for (const field of form.fields) {
    const answer = answers[field.id];

    if (field.isRequired && !isNonEmpty(answer)) {
      throw new BadRequestException(`Field "${field.labelAr}" is required`);
    }

    if (answer === undefined || answer === null) continue;

    if (OPTION_FIELD_TYPES.has(field.fieldType)) {
      const allowed = new Set((field.options as string[] | null) ?? []);
      const selected = Array.isArray(answer) ? answer : [answer];
      if (field.fieldType !== 'CHECKBOX' && Array.isArray(answer)) {
        throw new BadRequestException(`Field "${field.labelAr}" accepts a single value`);
      }
      for (const value of selected) {
        if (!allowed.has(value)) {
          throw new BadRequestException(`Invalid option "${value}" for field "${field.labelAr}"`);
        }
      }
    }
  }
}

function toPublicResponse(response: {
  id: string;
  bookingId: string;
  formId: string;
  clientId: string | null;
  answers: unknown;
  createdAt?: Date;
}) {
  return {
    id: response.id,
    bookingId: response.bookingId,
    formId: response.formId,
    clientId: response.clientId,
    answers: response.answers,
    ...(response.createdAt ? { createdAt: response.createdAt } : {}),
  };
}

/**
 * Validates and persists a client's answers to an intake form for a booking.
 *
 * Server-side validation:
 *   - form must exist and be active
 *   - every isRequired field must have a non-empty answer
 *   - answers may only reference fields belonging to the form
 *   - SELECT/RADIO/CHECKBOX answers must be within the field's options
 *
 * Idempotent on (bookingId, formId): a second submission overwrites the
 * previous answers rather than creating a duplicate row. clientId is derived
 * from the booking (and ownership enforced when a clientId is supplied).
 */
@Injectable()
export class SubmitIntakeResponseHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(command: SubmitIntakeResponseCommand) {
    const { bookingId, formId, answers, clientId } = command;

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, clientId: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (clientId && booking.clientId !== clientId) {
      // Do not leak existence details — treat as not found for this caller.
      throw new NotFoundException('Booking not found');
    }

    const form = await this.prisma.intakeForm.findUnique({
      where: { id: formId },
      include: { fields: true },
    });
    if (!form) {
      throw new NotFoundException('Intake form not found');
    }
    if (!form.isActive) {
      throw new BadRequestException('This intake form is no longer active');
    }

    validateAnswers(form, answers);

    return this.rlsTransaction.withTransaction(async (tx) => {
      // Submit takes shared row locks before the pair advisory lock. Delete
      // paths use the corresponding exclusive row lock, so submit/delete
      // cannot race through an outdated booking or form snapshot.
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR SHARE`;
      await tx.$queryRaw`SELECT "id" FROM "IntakeForm" WHERE "id" = ${formId} FOR SHARE`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intake:${bookingId}:${formId}`}, 0))`;

      const lockedBooking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, clientId: true },
      });
      if (!lockedBooking || (clientId && lockedBooking.clientId !== clientId)) {
        throw new NotFoundException('Booking not found');
      }

      const lockedForm = await tx.intakeForm.findUnique({
        where: { id: formId },
        include: { fields: true },
      });
      if (!lockedForm) throw new NotFoundException('Intake form not found');
      if (!lockedForm.isActive) throw new BadRequestException('This intake form is no longer active');
      validateAnswers(lockedForm, answers);

      const currentResponses = await tx.intakeResponse.findMany({
        where: { bookingId, formId, supersededAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      if (currentResponses.length > 1) {
        throw new ConflictException('More than one current intake response requires review');
      }

      const resolvedClientId = lockedBooking.clientId;
      const current = currentResponses[0];
      if (current) {
        if (areIntakeAnswersEqual(current.answers, answers)) {
          return toPublicResponse(current);
        }

        await tx.intakeResponseRevision.create({
          data: toIntakeRevisionData({
            id: current.id,
            bookingId: current.bookingId,
            formId: current.formId,
            clientId: current.clientId,
            answers: current.answers,
          }, 'UPDATE'),
        });
        const updated = await tx.intakeResponse.update({
          where: { id: current.id },
          data: { answers, clientId: resolvedClientId },
        });
        return toPublicResponse(updated);
      }

      const created = await tx.intakeResponse.create({
        data: { bookingId, formId, clientId: resolvedClientId, answers },
      });
      return toPublicResponse(created);
    });
  }
}
