import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { lockPersonReferences } from "../../../common/database/person-reference-lock.helper";
import { RecordLateSessionDto } from "./record-late-session.dto";
export async function lockLateSessionReferences(
  tx: Prisma.TransactionClient,
  dto: RecordLateSessionDto,
) {
  // The helper's lock-only mode takes ordered FOR UPDATE locks without its
  // present-day active gate. No deletion occurs: historical eligibility follows
  // under the same locks, admitting inactive people but never deleted clients.
  await lockPersonReferences(
    tx,
    [
      { kind: "Client", id: dto.clientId },
      { kind: "Employee", id: dto.employeeId },
    ],
    "delete",
  );
  // Cross-domain references have no FK: hold catalog rows and their bindings
  // until commit so concurrent removal cannot orphan a newly recorded fact.
  await tx.$queryRaw`SELECT "id" FROM "Branch" WHERE "id"=${dto.branchId} FOR SHARE`;
  await tx.$queryRaw`SELECT "id" FROM "Service" WHERE "id"=${dto.serviceId} FOR SHARE`;
  await tx.$queryRaw`SELECT "id" FROM "EmployeeBranch" WHERE "employeeId"=${dto.employeeId} AND "branchId"=${dto.branchId} FOR SHARE`;
  await tx.$queryRaw`SELECT "id" FROM "EmployeeService" WHERE "employeeId"=${dto.employeeId} AND "serviceId"=${dto.serviceId} FOR SHARE`;
  const [client, employee, branch, service, employeeBranch, employeeService] =
    await Promise.all([
      tx.client.findUnique({ where: { id: dto.clientId } }),
      tx.employee.findUnique({ where: { id: dto.employeeId } }),
      tx.branch.findUnique({ where: { id: dto.branchId } }),
      tx.service.findUnique({
        where: { id: dto.serviceId },
        include: { category: { include: { department: true } } },
      }),
      tx.employeeBranch.findUnique({
        where: {
          employeeId_branchId: {
            employeeId: dto.employeeId,
            branchId: dto.branchId,
          },
        },
      }),
      tx.employeeService.findUnique({
        where: {
          employeeId_serviceId: {
            employeeId: dto.employeeId,
            serviceId: dto.serviceId,
          },
        },
      }),
    ]);
  if (!client || client.deletedAt || !employee || !branch || !service)
    throw new NotFoundException(
      "Session reference was deleted or does not exist",
    );
  if (!employeeBranch || !employeeService)
    throw new BadRequestException(
      "Practitioner must be bound to the branch and service",
    );
  return { client, employee, branch, service };
}
export async function assertNoLateSessionOverlap(
  tx: Prisma.TransactionClient,
  dto: RecordLateSessionDto,
  scheduledAt: Date,
  endsAt: Date,
) {
  const conflict = await tx.booking.findFirst({
    where: {
      isHistoricalImport: false,
      status: { notIn: ["CANCELLED", "EXPIRED"] },
      scheduledAt: { lt: endsAt },
      endsAt: { gt: scheduledAt },
      OR: [{ clientId: dto.clientId }, { employeeId: dto.employeeId }],
    },
    select: { id: true },
  });
  if (conflict) throw lateSessionOverlapConflict(conflict.id);
}

export function lateSessionOverlapConflict(
  bookingId?: string,
): ConflictException {
  return new ConflictException({
    code: "ALREADY_RECORDED_SESSION",
    message:
      "This session overlaps an existing booking. Open that booking to review it.",
    ...(bookingId ? { bookingId } : {}),
  });
}

/** PostgreSQL exclusion errors may be wrapped differently by the Prisma adapter. */
export function isLateSessionExclusionConflict(error: unknown): boolean {
  const candidate = error as {
    code?: unknown;
    cause?: { originalCode?: unknown };
    meta?: {
      code?: unknown;
      driverAdapterError?: { cause?: { originalCode?: unknown } };
    };
  } | null;
  if (
    candidate?.code === "23P01" ||
    candidate?.meta?.code === "23P01" ||
    candidate?.cause?.originalCode === "23P01" ||
    candidate?.meta?.driverAdapterError?.cause?.originalCode === "23P01"
  )
    return true;
  // Prisma's unknown-request wrapper exposes some adapter failures only in the
  // Postgres diagnostic. Require both the code and this exact constraint name.
  return (
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    error.message.includes("23P01") &&
    error.message.includes("booking_staff_active_time_no_overlap")
  );
}

/** Run only after rollback; imported rows remain subject to the existing constraint. */
export async function findLateSessionConstraintConflict(
  tx: Prisma.TransactionClient,
  dto: RecordLateSessionDto,
) {
  const scheduledAt = new Date(dto.scheduledAt);
  return tx.booking.findFirst({
    where: {
      employeeId: dto.employeeId,
      programId: null,
      status: { notIn: ["CANCELLED", "EXPIRED"] },
      scheduledAt: {
        lt: new Date(scheduledAt.getTime() + dto.durationMins * 60000),
      },
      endsAt: { gt: scheduledAt },
    },
    select: { id: true },
  });
}
