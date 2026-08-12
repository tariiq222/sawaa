import type {
  LegacyImportDisposition,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { hashLegacyPayload } from './legacy-import.bundle';
import type {
  LegacyImportPlan,
  TargetReference,
} from './legacy-import.planner';
import type { LegacyBundleV1, LegacyFormInput } from './legacy-import.types';

const SOURCE_SYSTEM = 'booknetic';
const SOURCE_TENANT = '6';
const LEGACY_CATEGORY_NAME = 'خدمات النظام القديم';
const LEGACY_FORM_NAME = 'نموذج النظام القديم';

export interface ApplyReport {
  insertedServices: number;
  insertedEmployees: number;
  linkedExistingEmployees: number;
  insertedClients: number;
  linkedExistingClients: number;
  insertedBookings: number;
  insertedIntakeResponses: number;
  linkedExistingBookings: number;
  archivedOnlyBookings: number;
}

function fieldType(input: LegacyFormInput):
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'SELECT'
  | 'CHECKBOX'
  | 'RADIO' {
  switch (input.type) {
    case 'textarea':
      return 'TEXTAREA';
    case 'number':
      return 'NUMBER';
    case 'select':
      return 'SELECT';
    case 'checkbox':
      return 'CHECKBOX';
    case 'radio':
      return 'RADIO';
    default:
      return 'TEXT';
  }
}

function resolveReference(
  reference: TargetReference,
  newIds: ReadonlyMap<string, string>,
): string {
  if (reference.kind === 'existing') return reference.id;
  const id = newIds.get(reference.key);
  if (!id) throw new Error(`missing inserted target for ${reference.key}`);
  return id;
}

function importRecordKey(entityType: string, legacyId: number | string): string {
  return `${entityType}:${legacyId}`;
}

async function assertNoSourceDrift(
  tx: Prisma.TransactionClient,
  entityType: string,
  legacyId: number | string,
  payloadHash: string,
): Promise<boolean> {
  const existing = await tx.legacyImportRecord.findUnique({
    where: {
      sourceSystem_sourceTenant_entityType_legacyId: {
        sourceSystem: SOURCE_SYSTEM,
        sourceTenant: SOURCE_TENANT,
        entityType,
        legacyId: String(legacyId),
      },
    },
    select: { payloadHash: true },
  });
  if (!existing) return false;
  if (existing.payloadHash !== payloadHash) {
    throw new Error(`source drift for ${importRecordKey(entityType, legacyId)}`);
  }
  return true;
}

async function createImportRecord(
  tx: Prisma.TransactionClient,
  input: {
    entityType: string;
    legacyId: number | string;
    targetType?: string;
    targetId?: string;
    disposition: LegacyImportDisposition;
    payloadHash: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.legacyImportRecord.create({
    data: {
      sourceSystem: SOURCE_SYSTEM,
      sourceTenant: SOURCE_TENANT,
      entityType: input.entityType,
      legacyId: String(input.legacyId),
      targetType: input.targetType,
      targetId: input.targetId,
      disposition: input.disposition,
      payloadHash: input.payloadHash,
      metadata: input.metadata,
    },
  });
}

export async function applyLegacyImportPlan(
  prisma: PrismaClient,
  bundle: LegacyBundleV1,
  plan: LegacyImportPlan,
): Promise<ApplyReport> {
  // Operator-only one-shot import outside HTTP/user context. Sawaa is
  // single-tenant and RLS has been removed; a direct transaction keeps the
  // complete historical import atomic while the backend service is stopped.
  // eslint-disable-next-line no-restricted-syntax
  return prisma.$transaction(
    async (tx) => {
      const report: ApplyReport = {
        insertedServices: 0,
        insertedEmployees: 0,
        linkedExistingEmployees: 0,
        insertedClients: 0,
        linkedExistingClients: 0,
        insertedBookings: 0,
        insertedIntakeResponses: 0,
        linkedExistingBookings: 0,
        archivedOnlyBookings: 0,
      };
      const clientIds = new Map<string, string>();
      const employeeIds = new Map<string, string>();
      const serviceIds = new Map<number, string>();
      const bookingIds = new Map<number, string>();
      const bookingClientIds = new Map<number, string>();
      const sourceCustomers = new Map(bundle.customers.map((row) => [row.id, row]));
      const sourceStaff = new Map(bundle.staff.map((row) => [row.id, row]));
      const sourceServices = new Map(bundle.services.map((row) => [row.id, row]));
      const sourceAppointments = new Map(bundle.appointments.map((row) => [row.id, row]));

      let categoryId: string | undefined;
      if (plan.historicalServices.length > 0) {
        const categoryHash = hashLegacyPayload({ name: LEGACY_CATEGORY_NAME });
        const existingCategoryRecord = await tx.legacyImportRecord.findUnique({
          where: {
            sourceSystem_sourceTenant_entityType_legacyId: {
              sourceSystem: SOURCE_SYSTEM,
              sourceTenant: SOURCE_TENANT,
              entityType: 'SERVICE_CATEGORY',
              legacyId: 'legacy-services',
            },
          },
        });
        if (existingCategoryRecord) {
          if (existingCategoryRecord.payloadHash !== categoryHash) {
            throw new Error('source drift for SERVICE_CATEGORY:legacy-services');
          }
          categoryId = existingCategoryRecord.targetId ?? undefined;
        } else {
          const category = await tx.serviceCategory.create({
            data: {
              nameAr: LEGACY_CATEGORY_NAME,
              isActive: false,
              bookingMode: 'SERVICES',
            },
            select: { id: true },
          });
          categoryId = category.id;
          await createImportRecord(tx, {
            entityType: 'SERVICE_CATEGORY',
            legacyId: 'legacy-services',
            targetType: 'ServiceCategory',
            targetId: category.id,
            disposition: 'IMPORTED',
            payloadHash: categoryHash,
          });
        }
        if (!categoryId) throw new Error('legacy service category target is missing');
      }

      for (const servicePlan of plan.historicalServices) {
        const source = sourceServices.get(servicePlan.legacyId) ?? servicePlan;
        const payloadHash = hashLegacyPayload(source);
        const existingRecord = await tx.legacyImportRecord.findUnique({
          where: {
            sourceSystem_sourceTenant_entityType_legacyId: {
              sourceSystem: SOURCE_SYSTEM,
              sourceTenant: SOURCE_TENANT,
              entityType: 'SERVICE',
              legacyId: String(servicePlan.legacyId),
            },
          },
        });
        if (existingRecord) {
          if (existingRecord.payloadHash !== payloadHash) {
            throw new Error(`source drift for SERVICE:${servicePlan.legacyId}`);
          }
          if (!existingRecord.targetId) throw new Error('service import target is missing');
          serviceIds.set(servicePlan.legacyId, existingRecord.targetId);
          continue;
        }
        const service = await tx.service.create({
          data: {
            categoryId,
            nameAr: servicePlan.nameAr,
            durationMins: servicePlan.durationMins,
            price: servicePlan.priceHalalas,
            currency: 'SAR',
            isActive: false,
            archivedAt: plan.cutoverAt,
            // Public catalog requires active + unarchived. The DB allows only one
            // `isHidden` service per category, so historical services stay false
            // while inactive + archived makes all 18 non-public and unbookable.
            isHidden: false,
            depositEnabled: false,
          },
          select: { id: true },
        });
        serviceIds.set(servicePlan.legacyId, service.id);
        await createImportRecord(tx, {
          entityType: 'SERVICE',
          legacyId: servicePlan.legacyId,
          targetType: 'Service',
          targetId: service.id,
          disposition: 'IMPORTED',
          payloadHash,
        });
        report.insertedServices += 1;
      }

      for (const employeePlan of plan.employeeMatches.newHistoricalEmployees) {
        const payload = employeePlan.legacyIds.map((id) => sourceStaff.get(id));
        const payloadHash = hashLegacyPayload(payload);
        const primaryLegacyId = employeePlan.legacyIds[0]!;
        const existingRecord = await tx.legacyImportRecord.findUnique({
          where: {
            sourceSystem_sourceTenant_entityType_legacyId: {
              sourceSystem: SOURCE_SYSTEM,
              sourceTenant: SOURCE_TENANT,
              entityType: 'EMPLOYEE',
              legacyId: String(primaryLegacyId),
            },
          },
        });
        if (existingRecord) {
          if (existingRecord.payloadHash !== payloadHash || !existingRecord.targetId) {
            throw new Error(`source drift for EMPLOYEE:${primaryLegacyId}`);
          }
          employeeIds.set(employeePlan.key, existingRecord.targetId);
          continue;
        }
        const employee = await tx.employee.create({
          data: {
            name: employeePlan.name,
            nameAr: employeePlan.name,
            email: employeePlan.email,
            phone: employeePlan.phone,
            specialty: employeePlan.profession,
            specialtyAr: employeePlan.profession,
            userId: null,
            onboardingStatus: 'PENDING',
            isActive: false,
            isPublic: false,
          },
          select: { id: true },
        });
        employeeIds.set(employeePlan.key, employee.id);
        for (const legacyId of employeePlan.legacyIds) {
          await createImportRecord(tx, {
            entityType: 'EMPLOYEE',
            legacyId,
            targetType: 'Employee',
            targetId: employee.id,
            disposition: 'IMPORTED',
            payloadHash,
          });
        }
        report.insertedEmployees += 1;
      }

      for (const [legacyId, reference] of plan.employeeMatches.legacyToEmployee) {
        if (reference.kind !== 'existing') continue;
        const source = sourceStaff.get(legacyId);
        if (!source) throw new Error(`missing source employee ${legacyId}`);
        const payloadHash = hashLegacyPayload(source);
        if (await assertNoSourceDrift(tx, 'EMPLOYEE', legacyId, payloadHash)) continue;
        await createImportRecord(tx, {
          entityType: 'EMPLOYEE',
          legacyId,
          targetType: 'Employee',
          targetId: reference.id,
          disposition: 'LINKED_EXISTING',
          payloadHash,
        });
        report.linkedExistingEmployees += 1;
      }

      for (const clientPlan of plan.clientMatches.newClients) {
        const payload = clientPlan.legacyIds.map((id) => sourceCustomers.get(id));
        const payloadHash = hashLegacyPayload(payload);
        const primaryLegacyId = clientPlan.legacyIds[0]!;
        const existingRecord = await tx.legacyImportRecord.findUnique({
          where: {
            sourceSystem_sourceTenant_entityType_legacyId: {
              sourceSystem: SOURCE_SYSTEM,
              sourceTenant: SOURCE_TENANT,
              entityType: 'CLIENT',
              legacyId: String(primaryLegacyId),
            },
          },
        });
        if (existingRecord) {
          if (existingRecord.payloadHash !== payloadHash || !existingRecord.targetId) {
            throw new Error(`source drift for CLIENT:${primaryLegacyId}`);
          }
          clientIds.set(clientPlan.key, existingRecord.targetId);
          continue;
        }
        const canonical = clientPlan.canonical;
        const gender = canonical.gender?.toLowerCase() === 'male'
          ? 'MALE'
          : canonical.gender?.toLowerCase() === 'female'
            ? 'FEMALE'
            : undefined;
        const client = await tx.client.create({
          data: {
            name: clientPlan.name,
            firstName: canonical.firstName?.trim() || undefined,
            lastName: canonical.lastName?.trim() || undefined,
            phone: clientPlan.phone,
            email: clientPlan.email,
            gender,
            dateOfBirth: canonical.birthdate
              ? new Date(`${canonical.birthdate}T00:00:00Z`)
              : undefined,
            notes: canonical.notes,
            source: 'WALK_IN',
            accountType: 'WALK_IN',
            userId: null,
            passwordHash: null,
            consentedAt: null,
          },
          select: { id: true },
        });
        clientIds.set(clientPlan.key, client.id);
        for (const legacyId of clientPlan.legacyIds) {
          await createImportRecord(tx, {
            entityType: 'CLIENT',
            legacyId,
            targetType: 'Client',
            targetId: client.id,
            disposition: 'IMPORTED',
            payloadHash,
          });
        }
        report.insertedClients += 1;
      }

      for (const [legacyId, reference] of plan.clientMatches.legacyToClient) {
        if (reference.kind !== 'existing') continue;
        const source = sourceCustomers.get(legacyId);
        if (!source) throw new Error(`missing source client ${legacyId}`);
        const payloadHash = hashLegacyPayload(source);
        if (await assertNoSourceDrift(tx, 'CLIENT', legacyId, payloadHash)) continue;
        await createImportRecord(tx, {
          entityType: 'CLIENT',
          legacyId,
          targetType: 'Client',
          targetId: reference.id,
          disposition: 'LINKED_EXISTING',
          payloadHash,
        });
        report.linkedExistingClients += 1;
      }

      for (const bookingPlan of plan.newBookings) {
        const source = sourceAppointments.get(bookingPlan.legacyAppointmentId) ?? bookingPlan;
        const payloadHash = hashLegacyPayload(source);
        if (
          await assertNoSourceDrift(
            tx,
            'APPOINTMENT',
            bookingPlan.legacyAppointmentId,
            payloadHash,
          )
        ) {
          const record = await tx.legacyImportRecord.findUniqueOrThrow({
            where: {
              sourceSystem_sourceTenant_entityType_legacyId: {
                sourceSystem: SOURCE_SYSTEM,
                sourceTenant: SOURCE_TENANT,
                entityType: 'APPOINTMENT',
                legacyId: String(bookingPlan.legacyAppointmentId),
              },
            },
          });
          if (record.targetId) bookingIds.set(bookingPlan.legacyAppointmentId, record.targetId);
          continue;
        }
        const serviceId = serviceIds.get(bookingPlan.legacyServiceId);
        if (!serviceId) throw new Error(`missing service ${bookingPlan.legacyServiceId}`);
        const clientId = resolveReference(bookingPlan.client, clientIds);
        const booking = await tx.booking.create({
          data: {
            branchId: bookingPlan.branchId,
            clientId,
            employeeId: resolveReference(bookingPlan.employee, employeeIds),
            serviceId,
            bookingType: 'INDIVIDUAL',
            deliveryType: bookingPlan.deliveryType,
            source: 'RECEPTION',
            status: bookingPlan.status,
            isHistoricalImport: true,
            scheduledAt: bookingPlan.scheduledAt,
            endsAt: bookingPlan.endsAt,
            durationMins: bookingPlan.durationMins,
            price: bookingPlan.priceHalalas,
            currency: 'SAR',
            notes: bookingPlan.notes,
            priceSnapshot: bookingPlan.priceHalalas,
            durationMinutesSnapshot: bookingPlan.durationMins,
            branchNameSnapshot: bookingPlan.branchNameSnapshot,
            employeeNameSnapshot: bookingPlan.employeeNameSnapshot,
            serviceNameSnapshot: bookingPlan.serviceNameSnapshot,
            categoryNameSnapshot: bookingPlan.categoryNameSnapshot,
            bookingNumber: bookingPlan.bookingNumber,
          },
          select: { id: true },
        });
        bookingIds.set(bookingPlan.legacyAppointmentId, booking.id);
        bookingClientIds.set(bookingPlan.legacyAppointmentId, clientId);
        await tx.bookingStatusLog.create({
          data: {
            bookingId: booking.id,
            fromStatus: null,
            toStatus: bookingPlan.status,
            changedBy: 'LEGACY_IMPORT',
            reason: `Booknetic source status: ${bookingPlan.sourceStatus}`,
          },
        });
        await createImportRecord(tx, {
          entityType: 'APPOINTMENT',
          legacyId: bookingPlan.legacyAppointmentId,
          targetType: 'Booking',
          targetId: booking.id,
          disposition: 'IMPORTED',
          payloadHash,
          metadata: {
            sourceStatus: bookingPlan.sourceStatus,
            paymentMethod: bookingPlan.sourcePaymentMethod,
            paymentStatus: bookingPlan.sourcePaymentStatus,
            paidAmount: bookingPlan.sourcePaidAmount,
            cutoverAt: plan.cutoverAt.toISOString(),
          },
        });
        report.insertedBookings += 1;
      }

      for (const [legacyId, disposition] of plan.appointmentDispositions) {
        if (disposition.kind === 'IMPORTED') continue;
        const source = sourceAppointments.get(legacyId);
        if (!source) continue;
        const payloadHash = hashLegacyPayload(source);
        if (await assertNoSourceDrift(tx, 'APPOINTMENT', legacyId, payloadHash)) continue;
        const answers = bundle.appointmentCustomData
          .filter((row) => row.appointmentId === legacyId)
          .map((row) => ({
            formInputId: row.formInputId,
            inputValue: row.inputValue,
            inputFileName: row.inputFileName,
          }));
        await createImportRecord(tx, {
          entityType: 'APPOINTMENT',
          legacyId,
          targetType:
            disposition.kind === 'LINKED_EXISTING' ? 'Booking' : undefined,
          targetId:
            disposition.kind === 'LINKED_EXISTING'
              ? disposition.targetBookingId
              : undefined,
          disposition: disposition.kind,
          payloadHash,
          metadata: {
            sourceStatus: source.status,
            paymentMethod: source.paymentMethod,
            paymentStatus: source.paymentStatus,
            paidAmount: source.paidAmount,
            cutoverAt: plan.cutoverAt.toISOString(),
            ...(disposition.kind === 'ARCHIVED_ONLY'
              ? { reason: disposition.reason, answers }
              : {}),
          },
        });
        if (disposition.kind === 'LINKED_EXISTING') {
          bookingIds.set(legacyId, disposition.targetBookingId);
          const linkedBooking = await tx.booking.findUniqueOrThrow({
            where: { id: disposition.targetBookingId },
            select: { clientId: true },
          });
          bookingClientIds.set(legacyId, linkedBooking.clientId);
          report.linkedExistingBookings += 1;
        } else {
          report.archivedOnlyBookings += 1;
        }
      }

      const historicalCustomData = bundle.appointmentCustomData.filter(
        (row) => bookingIds.has(row.appointmentId),
      );
      if (historicalCustomData.length > 0) {
        const formHash = hashLegacyPayload({ name: LEGACY_FORM_NAME });
        let formId: string;
        const existingFormRecord = await tx.legacyImportRecord.findUnique({
          where: {
            sourceSystem_sourceTenant_entityType_legacyId: {
              sourceSystem: SOURCE_SYSTEM,
              sourceTenant: SOURCE_TENANT,
              entityType: 'INTAKE_FORM',
              legacyId: 'legacy-form',
            },
          },
        });
        if (existingFormRecord) {
          if (existingFormRecord.payloadHash !== formHash || !existingFormRecord.targetId) {
            throw new Error('source drift for INTAKE_FORM:legacy-form');
          }
          formId = existingFormRecord.targetId;
        } else {
          const form = await tx.intakeForm.create({
            data: {
              nameAr: LEGACY_FORM_NAME,
              type: 'PRE_SESSION',
              scope: 'GLOBAL',
              isActive: false,
            },
            select: { id: true },
          });
          formId = form.id;
          await createImportRecord(tx, {
            entityType: 'INTAKE_FORM',
            legacyId: 'legacy-form',
            targetType: 'IntakeForm',
            targetId: form.id,
            disposition: 'IMPORTED',
            payloadHash: formHash,
          });
        }

        const inputIds = new Map<number, string>();
        const choicesByInput = new Map<number, string[]>();
        for (const choice of bundle.formInputChoices) {
          choicesByInput.set(choice.formInputId, [
            ...(choicesByInput.get(choice.formInputId) ?? []),
            choice.title,
          ]);
        }
        for (const input of bundle.formInputs) {
          const payloadHash = hashLegacyPayload(input);
          const existingFieldRecord = await tx.legacyImportRecord.findUnique({
            where: {
              sourceSystem_sourceTenant_entityType_legacyId: {
                sourceSystem: SOURCE_SYSTEM,
                sourceTenant: SOURCE_TENANT,
                entityType: 'INTAKE_FIELD',
                legacyId: String(input.id),
              },
            },
          });
          if (existingFieldRecord) {
            if (existingFieldRecord.payloadHash !== payloadHash || !existingFieldRecord.targetId) {
              throw new Error(`source drift for INTAKE_FIELD:${input.id}`);
            }
            inputIds.set(input.id, existingFieldRecord.targetId);
            continue;
          }
          const field = await tx.intakeField.create({
            data: {
              formId,
              labelAr: input.label.trim() || `حقل نظام قديم ${input.id}`,
              fieldType: fieldType(input),
              isRequired: input.isRequired,
              options: choicesByInput.get(input.id),
              position: input.orderNumber,
            },
            select: { id: true },
          });
          inputIds.set(input.id, field.id);
          await createImportRecord(tx, {
            entityType: 'INTAKE_FIELD',
            legacyId: input.id,
            targetType: 'IntakeField',
            targetId: field.id,
            disposition: 'IMPORTED',
            payloadHash,
          });
        }

        const answersByAppointment = new Map<number, Record<string, string>>();
        for (const row of historicalCustomData) {
          const fieldId = inputIds.get(row.formInputId);
          if (!fieldId) continue;
          const answers = answersByAppointment.get(row.appointmentId) ?? {};
          answers[fieldId] = row.inputValue ?? row.inputFileName ?? '';
          answersByAppointment.set(row.appointmentId, answers);
        }
        for (const [appointmentId, answers] of answersByAppointment) {
          const payloadHash = hashLegacyPayload(answers);
          if (await assertNoSourceDrift(tx, 'INTAKE_RESPONSE', appointmentId, payloadHash)) {
            continue;
          }
          const bookingId = bookingIds.get(appointmentId);
          if (!bookingId) continue;
          const response = await tx.intakeResponse.create({
            data: {
              formId,
              bookingId,
              clientId: bookingClientIds.get(appointmentId),
              answers,
            },
            select: { id: true },
          });
          await createImportRecord(tx, {
            entityType: 'INTAKE_RESPONSE',
            legacyId: appointmentId,
            targetType: 'IntakeResponse',
            targetId: response.id,
            disposition: 'IMPORTED',
            payloadHash,
          });
          report.insertedIntakeResponses += 1;
        }
      }

      return report;
    },
    { maxWait: 20_000, timeout: 300_000 },
  );
}
