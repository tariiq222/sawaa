import {
  canonicalName,
  epochSecondsToDate,
  mapDeliveryType,
  mapHistoricalStatus,
  normalizeEmail,
  normalizeSaudiPhone,
  sarToHalalas,
} from './legacy-import.normalization';
import { partitionAppointments } from './legacy-import.bundle';
import type {
  LegacyAppointment,
  LegacyBundleV1,
  LegacyCustomer,
  LegacyService,
  LegacyStaff,
} from './legacy-import.types';
import type { PrismaClient } from '@prisma/client';

export interface TargetClientSnapshot {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

export interface TargetEmployeeSnapshot {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  isPublic: boolean;
}

export interface TargetBookingSnapshot {
  id: string;
  clientId: string;
  employeeId: string;
  bookingNumber: number;
  scheduledAt: Date;
  endsAt: Date;
  status: string;
}

export interface TargetImportRecordSnapshot {
  entityType: string;
  legacyId: string;
  targetType: string | null;
  targetId: string | null;
  disposition: 'IMPORTED' | 'LINKED_EXISTING' | 'ARCHIVED_ONLY' | 'SKIPPED';
  payloadHash: string;
}

export interface TargetSnapshot {
  mainBranch: { id: string; nameAr: string };
  clients: TargetClientSnapshot[];
  employees: TargetEmployeeSnapshot[];
  bookings: TargetBookingSnapshot[];
  importRecords: TargetImportRecordSnapshot[];
}

export async function loadTargetSnapshot(
  prisma: PrismaClient,
): Promise<TargetSnapshot> {
  const [mainBranch, clients, employees, bookings, importRecords] =
    await Promise.all([
      prisma.branch.findFirst({
        where: { isMain: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true, nameAr: true },
      }),
      prisma.client.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, phone: true, email: true, notes: true },
      }),
      prisma.employee.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          isActive: true,
          isPublic: true,
        },
      }),
      prisma.booking.findMany({
        select: {
          id: true,
          clientId: true,
          employeeId: true,
          bookingNumber: true,
          scheduledAt: true,
          endsAt: true,
          status: true,
        },
      }),
      prisma.legacyImportRecord.findMany({
        where: { sourceSystem: 'booknetic', sourceTenant: '6' },
        select: {
          entityType: true,
          legacyId: true,
          targetType: true,
          targetId: true,
          disposition: true,
          payloadHash: true,
        },
      }),
    ]);
  if (!mainBranch) throw new Error('target database has no main branch');
  return {
    mainBranch,
    clients,
    employees,
    bookings: bookings.map((row) => ({ ...row, status: row.status.toString() })),
    importRecords,
  };
}

export type TargetReference =
  | { kind: 'existing'; id: string }
  | { kind: 'new'; key: string };

export interface HistoricalEmployeePlan {
  key: string;
  legacyIds: number[];
  name: string;
  email: string | null;
  phone: string | null;
  profession: string | null;
}

export interface EmployeeMatchPlan {
  legacyToEmployee: Map<number, TargetReference>;
  newHistoricalEmployees: HistoricalEmployeePlan[];
  matchedCurrentEmployeeIds: string[];
}

export interface HistoricalClientPlan {
  key: string;
  legacyIds: number[];
  canonical: LegacyCustomer;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface ClientMatchPlan {
  legacyToClient: Map<number, TargetReference>;
  newClients: HistoricalClientPlan[];
  matchedCurrentClientIds: string[];
}

export interface HistoricalServicePlan {
  legacyId: number;
  nameAr: string;
  originalName: string;
  originalCategoryName: string | null;
  durationMins: number;
  priceHalalas: number;
}

export interface PlannedBooking {
  legacyAppointmentId: number;
  bookingNumber: number;
  branchId: string;
  client: TargetReference;
  employee: TargetReference;
  legacyServiceId: number;
  status: 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
  deliveryType: 'IN_PERSON' | 'ONLINE';
  scheduledAt: Date;
  endsAt: Date;
  durationMins: number;
  priceHalalas: number;
  notes: string | null;
  branchNameSnapshot: string;
  employeeNameSnapshot: string;
  serviceNameSnapshot: string;
  categoryNameSnapshot: string | null;
  sourceStatus: string;
  sourcePaymentMethod: string | null;
  sourcePaymentStatus: string | null;
  sourcePaidAmount: string;
}

export type AppointmentDisposition =
  | { kind: 'IMPORTED' }
  | { kind: 'LINKED_EXISTING'; targetBookingId: string }
  | { kind: 'ARCHIVED_ONLY'; reason: 'EMPLOYEE_TIME_OVERLAP' };

export interface LegacyImportPlan {
  cutoverAt: Date;
  excludedAppointmentIds: number[];
  historicalServices: HistoricalServicePlan[];
  employeeMatches: EmployeeMatchPlan;
  clientMatches: ClientMatchPlan;
  newHistoricalEmployees: HistoricalEmployeePlan[];
  matchedCurrentEmployeeIds: string[];
  newBookings: PlannedBooking[];
  appointmentDispositions: Map<number, AppointmentDisposition>;
}

interface PlannerOptions {
  enforceProductionCounts?: boolean;
}

function addIndex(
  index: Map<string, TargetEmployeeSnapshot[]>,
  key: string | null,
  row: TargetEmployeeSnapshot,
): void {
  if (!key) return;
  const rows = index.get(key) ?? [];
  rows.push(row);
  index.set(key, rows);
}

function staffCompleteness(row: LegacyStaff): number {
  return [row.email, row.phone, row.profession].filter(Boolean).length;
}

function canonicalStaff(
  rows: LegacyStaff[],
  appointmentCounts: ReadonlyMap<number, number>,
): LegacyStaff {
  return [...rows].sort((left, right) => {
    const appointmentDelta =
      (appointmentCounts.get(right.id) ?? 0) -
      (appointmentCounts.get(left.id) ?? 0);
    if (appointmentDelta !== 0) return appointmentDelta;
    const completenessDelta = staffCompleteness(right) - staffCompleteness(left);
    if (completenessDelta !== 0) return completenessDelta;
    return left.id - right.id;
  })[0]!;
}

function historicalStaffKey(row: LegacyStaff): string {
  if (row.id === 141 || row.id === 155) return 'legacy-staff:141+155';
  return `legacy-staff:${row.id}`;
}

export function matchLegacyEmployees(
  legacyStaff: readonly LegacyStaff[],
  targetEmployees: readonly TargetEmployeeSnapshot[],
  appointmentCounts: ReadonlyMap<number, number>,
): EmployeeMatchPlan {
  const byPhone = new Map<string, TargetEmployeeSnapshot[]>();
  const byEmail = new Map<string, TargetEmployeeSnapshot[]>();
  for (const employee of targetEmployees) {
    addIndex(byPhone, normalizeSaudiPhone(employee.phone), employee);
    addIndex(byEmail, normalizeEmail(employee.email), employee);
  }

  const legacyToEmployee = new Map<number, TargetReference>();
  const unmatchedGroups = new Map<string, LegacyStaff[]>();
  const matchedCurrentIds = new Set<string>();

  for (const staff of legacyStaff) {
    const phone = normalizeSaudiPhone(staff.phone);
    const email = normalizeEmail(staff.email);
    const phoneMatches = phone ? (byPhone.get(phone) ?? []) : [];
    const emailMatches = email ? (byEmail.get(email) ?? []) : [];
    if (phoneMatches.length > 1) {
      throw new Error(`ambiguous current employee phone for legacy staff ${staff.id}`);
    }
    if (emailMatches.length > 1) {
      throw new Error(`ambiguous current employee email for legacy staff ${staff.id}`);
    }
    const matches = new Map(
      [...phoneMatches, ...emailMatches].map((row) => [row.id, row]),
    );
    if (matches.size > 1) {
      throw new Error(`conflicting employee matches for legacy staff ${staff.id}`);
    }
    const existing = [...matches.values()][0];
    if (existing) {
      legacyToEmployee.set(staff.id, { kind: 'existing', id: existing.id });
      matchedCurrentIds.add(existing.id);
      continue;
    }
    const key = historicalStaffKey(staff);
    const rows = unmatchedGroups.get(key) ?? [];
    rows.push(staff);
    unmatchedGroups.set(key, rows);
  }

  const newHistoricalEmployees: HistoricalEmployeePlan[] = [];
  for (const [key, rows] of [...unmatchedGroups.entries()].sort()) {
    const canonical = canonicalStaff(rows, appointmentCounts);
    const legacyIds = rows.map((row) => row.id).sort((a, b) => a - b);
    newHistoricalEmployees.push({
      key,
      legacyIds,
      name:
        canonical.id === 99
          ? 'استشارة مجانية — سجل نظام قديم'
          : canonicalName(canonical.name),
      email: normalizeEmail(canonical.email),
      phone: normalizeSaudiPhone(canonical.phone),
      profession: canonical.profession?.trim() || null,
    });
    for (const row of rows) {
      legacyToEmployee.set(row.id, { kind: 'new', key });
    }
  }

  return {
    legacyToEmployee,
    newHistoricalEmployees,
    matchedCurrentEmployeeIds: [...matchedCurrentIds].sort(),
  };
}

function clientCompleteness(row: LegacyCustomer): number {
  return [
    row.firstName,
    row.lastName,
    row.email,
    row.gender,
    row.birthdate,
    row.notes,
  ].filter(Boolean).length;
}

function clientName(row: LegacyCustomer): string {
  const name = canonicalName(`${row.firstName ?? ''} ${row.lastName ?? ''}`);
  return name || `عميل نظام قديم ${row.id}`;
}

export function matchLegacyClients(
  legacyCustomers: readonly LegacyCustomer[],
  targetClients: readonly TargetClientSnapshot[],
  appointmentCounts: ReadonlyMap<number, number>,
): ClientMatchPlan {
  const byPhone = new Map<string, TargetClientSnapshot[]>();
  const byEmail = new Map<string, TargetClientSnapshot[]>();
  for (const client of targetClients) {
    const phone = normalizeSaudiPhone(client.phone);
    const email = normalizeEmail(client.email);
    if (phone) byPhone.set(phone, [...(byPhone.get(phone) ?? []), client]);
    if (email) byEmail.set(email, [...(byEmail.get(email) ?? []), client]);
  }

  const legacyToClient = new Map<number, TargetReference>();
  const newGroups = new Map<string, LegacyCustomer[]>();
  const matchedIds = new Set<string>();

  for (const customer of legacyCustomers) {
    const phone = normalizeSaudiPhone(customer.phone);
    const email = normalizeEmail(customer.email);
    const matches = phone ? (byPhone.get(phone) ?? []) : email ? (byEmail.get(email) ?? []) : [];
    if (matches.length > 1) {
      throw new Error(`ambiguous current client match for legacy customer ${customer.id}`);
    }
    if (matches[0]) {
      legacyToClient.set(customer.id, { kind: 'existing', id: matches[0].id });
      matchedIds.add(matches[0].id);
      continue;
    }
    const key = phone
      ? `legacy-client:phone:${phone}`
      : email
        ? `legacy-client:email:${email}`
        : `legacy-client:id:${customer.id}`;
    newGroups.set(key, [...(newGroups.get(key) ?? []), customer]);
  }

  const newClients: HistoricalClientPlan[] = [];
  const reservedEmails = new Set(byEmail.keys());
  for (const [key, rows] of [...newGroups.entries()].sort()) {
    const canonical = [...rows].sort((left, right) => {
      const appointmentDelta =
        (appointmentCounts.get(right.id) ?? 0) -
        (appointmentCounts.get(left.id) ?? 0);
      if (appointmentDelta !== 0) return appointmentDelta;
      const completenessDelta = clientCompleteness(right) - clientCompleteness(left);
      if (completenessDelta !== 0) return completenessDelta;
      return left.id - right.id;
    })[0]!;
    const legacyIds = rows.map((row) => row.id).sort((a, b) => a - b);
    const email = normalizeEmail(canonical.email);
    if (email && reservedEmails.has(email)) {
      throw new Error(`client email collision for legacy customer ${canonical.id}`);
    }
    if (email) reservedEmails.add(email);
    newClients.push({
      key,
      legacyIds,
      canonical,
      name: clientName(canonical),
      phone: normalizeSaudiPhone(canonical.phone),
      email,
    });
    for (const row of rows) legacyToClient.set(row.id, { kind: 'new', key });
  }

  return {
    legacyToClient,
    newClients,
    matchedCurrentClientIds: [...matchedIds].sort(),
  };
}

function countReferences(
  appointments: readonly LegacyAppointment[],
  field: 'staffId' | 'customerId',
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const appointment of appointments) {
    const id = appointment[field];
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function isBlockingStatus(status: string): boolean {
  return new Set([
    'PENDING',
    'PENDING_GROUP_FILL',
    'AWAITING_PAYMENT',
    'CONFIRMED',
    'CANCEL_REQUESTED',
    'DEPOSIT_PAID',
    'COMPLETED',
    'NO_SHOW',
  ]).has(status);
}

function intervalsOverlap(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function getExistingId(reference: TargetReference): string | null {
  return reference.kind === 'existing' ? reference.id : null;
}

function assertProductionCounts(plan: LegacyImportPlan, bundle: LegacyBundleV1): void {
  if (bundle.appointments.length !== 5_035) {
    throw new Error(`expected 5035 source appointments, got ${bundle.appointments.length}`);
  }
  if (plan.excludedAppointmentIds.length !== 11) {
    throw new Error(`expected 11 excluded appointments, got ${plan.excludedAppointmentIds.length}`);
  }
  if (plan.newBookings.length !== 5_022) {
    throw new Error(`expected 5022 new bookings, got ${plan.newBookings.length}`);
  }
  if (plan.historicalServices.length !== 18) {
    throw new Error(`expected 18 historical services, got ${plan.historicalServices.length}`);
  }
  if (plan.newHistoricalEmployees.length !== 18) {
    throw new Error(
      `expected 18 historical employees, got ${plan.newHistoricalEmployees.length}`,
    );
  }
  if (plan.matchedCurrentEmployeeIds.length !== 27) {
    throw new Error(
      `expected 27 matched current employees, got ${plan.matchedCurrentEmployeeIds.length}`,
    );
  }
  if (plan.appointmentDispositions.get(15834)?.kind !== 'LINKED_EXISTING') {
    throw new Error('legacy appointment 15834 must link to an existing booking');
  }
  if (plan.appointmentDispositions.get(15747)?.kind !== 'ARCHIVED_ONLY') {
    throw new Error('legacy appointment 15747 must be archived only');
  }
}

export function buildLegacyImportPlan(
  bundle: LegacyBundleV1,
  target: TargetSnapshot,
  cutoverAt: Date,
  options: PlannerOptions = {},
): LegacyImportPlan {
  const partition = partitionAppointments(bundle.appointments, cutoverAt);
  const importedEmployeeIds = new Set(
    target.importRecords
      .filter(
        (row) =>
          row.entityType === 'EMPLOYEE' &&
          row.disposition === 'IMPORTED' &&
          row.targetId,
      )
      .map((row) => row.targetId!),
  );
  const importedClientIds = new Set(
    target.importRecords
      .filter(
        (row) =>
          row.entityType === 'CLIENT' &&
          row.disposition === 'IMPORTED' &&
          row.targetId,
      )
      .map((row) => row.targetId!),
  );
  const importedBookingIds = new Set(
    target.importRecords
      .filter(
        (row) =>
          row.entityType === 'APPOINTMENT' &&
          row.disposition === 'IMPORTED' &&
          row.targetId,
      )
      .map((row) => row.targetId!),
  );
  const originalTargetEmployees = target.employees.filter(
    (row) => !importedEmployeeIds.has(row.id),
  );
  const originalTargetClients = target.clients.filter(
    (row) => !importedClientIds.has(row.id),
  );
  const originalTargetBookings = target.bookings.filter(
    (row) => !importedBookingIds.has(row.id),
  );
  const historicalStaffIds = new Set(partition.historical.map((row) => row.staffId));
  const historicalCustomerIds = new Set(
    partition.historical.map((row) => row.customerId),
  );
  const historicalServiceIds = new Set(
    partition.historical.map((row) => row.serviceId),
  );
  const historicalStaff = bundle.staff.filter((row) => historicalStaffIds.has(row.id));
  const historicalCustomers = bundle.customers.filter((row) =>
    historicalCustomerIds.has(row.id),
  );
  const historicalSourceServices = bundle.services.filter((row) =>
    historicalServiceIds.has(row.id),
  );

  const employeeMatches = matchLegacyEmployees(
    historicalStaff,
    originalTargetEmployees,
    countReferences(partition.historical, 'staffId'),
  );
  const clientMatches = matchLegacyClients(
    historicalCustomers,
    originalTargetClients,
    countReferences(partition.historical, 'customerId'),
  );

  const categoryNames = new Map(
    bundle.serviceCategories.map((row) => [row.id, row.name]),
  );
  const historicalServices: HistoricalServicePlan[] = historicalSourceServices
    .map((service) => ({
      legacyId: service.id,
      nameAr: `${canonicalName(service.name)} — نظام قديم`,
      originalName: canonicalName(service.name),
      originalCategoryName: service.categoryId
        ? (categoryNames.get(service.categoryId) ?? null)
        : null,
      durationMins: service.duration,
      priceHalalas: sarToHalalas(service.price),
    }))
    .sort((a, b) => a.legacyId - b.legacyId);
  const servicesById = new Map<number, LegacyService>(
    historicalSourceServices.map((row) => [row.id, row]),
  );
  const staffById = new Map(bundle.staff.map((row) => [row.id, row]));
  const locationNames = new Map(bundle.locations.map((row) => [row.id, row.name]));
  const existingBookingNumbers = new Set(
    originalTargetBookings.map((row) => row.bookingNumber),
  );
  const appointmentDispositions = new Map<number, AppointmentDisposition>();
  const newBookings: PlannedBooking[] = [];

  for (const appointment of partition.historical) {
    const client = clientMatches.legacyToClient.get(appointment.customerId);
    const employee = employeeMatches.legacyToEmployee.get(appointment.staffId);
    const service = servicesById.get(appointment.serviceId);
    const staff = staffById.get(appointment.staffId);
    if (!client || !employee || !service || !staff) {
      throw new Error(`appointment ${appointment.id} has an unresolved target relation`);
    }
    const bookingNumber = 1_000_000 + appointment.id;
    if (existingBookingNumbers.has(bookingNumber)) {
      throw new Error(`booking number collision for legacy appointment ${appointment.id}`);
    }
    const mappedStatus = mapHistoricalStatus(appointment.status);
    const scheduled = epochSecondsToDate(appointment.startsAt);
    const ends = epochSecondsToDate(appointment.endsAt);
    const existingEmployeeId = getExistingId(employee);
    const existingClientId = getExistingId(client);

    const overlaps = existingEmployeeId && mappedStatus === 'CONFIRMED'
      ? originalTargetBookings.filter(
          (row) =>
            row.employeeId === existingEmployeeId &&
            isBlockingStatus(row.status) &&
            intervalsOverlap(scheduled, ends, row.scheduledAt, row.endsAt),
        )
      : [];
    const exact = overlaps.filter(
      (row) =>
        existingClientId === row.clientId &&
        row.scheduledAt.getTime() === scheduled.getTime() &&
        row.endsAt.getTime() === ends.getTime(),
    );
    if (exact.length > 1 || overlaps.length > 1) {
      throw new Error(`ambiguous target booking overlap for legacy appointment ${appointment.id}`);
    }
    if (exact[0]) {
      appointmentDispositions.set(appointment.id, {
        kind: 'LINKED_EXISTING',
        targetBookingId: exact[0].id,
      });
      continue;
    }
    if (overlaps[0]) {
      appointmentDispositions.set(appointment.id, {
        kind: 'ARCHIVED_ONLY',
        reason: 'EMPLOYEE_TIME_OVERLAP',
      });
      continue;
    }

    const categoryName = service.categoryId
      ? (categoryNames.get(service.categoryId) ?? null)
      : null;
    newBookings.push({
      legacyAppointmentId: appointment.id,
      bookingNumber,
      branchId: target.mainBranch.id,
      client,
      employee,
      legacyServiceId: appointment.serviceId,
      status: mappedStatus,
      deliveryType: mapDeliveryType(appointment.serviceId),
      scheduledAt: scheduled,
      endsAt: ends,
      durationMins: Math.round((appointment.endsAt - appointment.startsAt) / 60),
      priceHalalas: sarToHalalas(service.price),
      notes: appointment.note,
      branchNameSnapshot:
        locationNames.get(appointment.locationId) ?? target.mainBranch.nameAr,
      employeeNameSnapshot: canonicalName(staff.name),
      serviceNameSnapshot: canonicalName(service.name),
      categoryNameSnapshot: categoryName,
      sourceStatus: appointment.status,
      sourcePaymentMethod: appointment.paymentMethod,
      sourcePaymentStatus: appointment.paymentStatus,
      sourcePaidAmount: appointment.paidAmount,
    });
    appointmentDispositions.set(appointment.id, { kind: 'IMPORTED' });
  }

  const plan: LegacyImportPlan = {
    cutoverAt,
    excludedAppointmentIds: partition.excluded.map((row) => row.id).sort((a, b) => a - b),
    historicalServices,
    employeeMatches,
    clientMatches,
    newHistoricalEmployees: employeeMatches.newHistoricalEmployees,
    matchedCurrentEmployeeIds: employeeMatches.matchedCurrentEmployeeIds,
    newBookings,
    appointmentDispositions,
  };
  if (options.enforceProductionCounts !== false) assertProductionCounts(plan, bundle);
  return plan;
}
