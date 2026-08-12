import { createHash } from 'node:crypto';
import type {
  AppointmentPartition,
  LegacyAppointment,
  LegacyBundleV1,
} from './legacy-import.types';

function assertObject(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('legacy bundle must be an object');
  }
}

function assertUniqueIds(
  rows: ReadonlyArray<{ id: number }>,
  entity: string,
): void {
  const seen = new Set<number>();
  for (const row of rows) {
    if (!Number.isInteger(row.id) || row.id <= 0) {
      throw new Error(`${entity} id must be a positive integer`);
    }
    if (seen.has(row.id)) {
      throw new Error(`duplicate ${entity} id ${row.id}`);
    }
    seen.add(row.id);
  }
}

function assertCount(label: string, expected: number, actual: number): void {
  if (expected !== actual) {
    throw new Error(`${label} count mismatch: expected ${expected}, got ${actual}`);
  }
}

export function validateLegacyBundle(value: unknown): LegacyBundleV1 {
  assertObject(value);
  if (value.schemaVersion !== 1) {
    throw new Error('schemaVersion must be 1');
  }
  if (value.sourceSystem !== 'booknetic') {
    throw new Error('sourceSystem must be booknetic');
  }
  if (value.sourceTenant !== 6) {
    throw new Error('sourceTenant must be 6');
  }

  const bundle = value as unknown as LegacyBundleV1;
  const arrayKeys = [
    'appointments',
    'customers',
    'staff',
    'services',
    'serviceCategories',
    'locations',
    'forms',
    'formInputs',
    'formInputChoices',
    'appointmentCustomData',
  ] as const;
  for (const key of arrayKeys) {
    if (!Array.isArray(bundle[key])) {
      throw new Error(`${key} must be an array`);
    }
  }
  if (!bundle.counts || typeof bundle.counts !== 'object') {
    throw new Error('counts must be an object');
  }

  assertUniqueIds(bundle.appointments, 'appointment');
  assertUniqueIds(bundle.customers, 'customer');
  assertUniqueIds(bundle.staff, 'staff');
  assertUniqueIds(bundle.services, 'service');
  assertUniqueIds(bundle.serviceCategories, 'service category');
  assertUniqueIds(bundle.locations, 'location');
  assertUniqueIds(bundle.forms, 'form');
  assertUniqueIds(bundle.formInputs, 'form input');
  assertUniqueIds(bundle.formInputChoices, 'form input choice');
  assertUniqueIds(bundle.appointmentCustomData, 'appointment custom data');

  assertCount('appointments', bundle.counts.appointments, bundle.appointments.length);
  assertCount('customers', bundle.counts.customers, bundle.customers.length);
  assertCount('staff', bundle.counts.staff, bundle.staff.length);
  assertCount('services', bundle.counts.services, bundle.services.length);
  assertCount('locations', bundle.counts.locations, bundle.locations.length);
  assertCount(
    'customData',
    bundle.counts.customData,
    bundle.appointmentCustomData.length,
  );

  const customerIds = new Set(bundle.customers.map((row) => row.id));
  const staffIds = new Set(bundle.staff.map((row) => row.id));
  const serviceIds = new Set(bundle.services.map((row) => row.id));
  const locationIds = new Set(bundle.locations.map((row) => row.id));
  const appointmentIds = new Set(bundle.appointments.map((row) => row.id));
  const formInputIds = new Set(bundle.formInputs.map((row) => row.id));

  for (const appointment of bundle.appointments) {
    if (!customerIds.has(appointment.customerId)) {
      throw new Error(
        `appointment ${appointment.id} references missing customer ${appointment.customerId}`,
      );
    }
    if (!staffIds.has(appointment.staffId)) {
      throw new Error(
        `appointment ${appointment.id} references missing staff ${appointment.staffId}`,
      );
    }
    if (!serviceIds.has(appointment.serviceId)) {
      throw new Error(
        `appointment ${appointment.id} references missing service ${appointment.serviceId}`,
      );
    }
    if (!locationIds.has(appointment.locationId)) {
      throw new Error(
        `appointment ${appointment.id} references missing location ${appointment.locationId}`,
      );
    }
    if (
      !Number.isFinite(appointment.startsAt) ||
      !Number.isFinite(appointment.endsAt) ||
      appointment.endsAt <= appointment.startsAt
    ) {
      throw new Error(`appointment ${appointment.id} has invalid epoch range`);
    }
  }

  for (const customData of bundle.appointmentCustomData) {
    if (!appointmentIds.has(customData.appointmentId)) {
      throw new Error(
        `custom data ${customData.id} references missing appointment ${customData.appointmentId}`,
      );
    }
    if (!formInputIds.has(customData.formInputId)) {
      throw new Error(
        `custom data ${customData.id} references missing form input ${customData.formInputId}`,
      );
    }
  }

  const extractedAt = new Date(bundle.extractedAt);
  if (Number.isNaN(extractedAt.getTime())) {
    throw new Error('extractedAt must be an ISO timestamp');
  }
  return bundle;
}

export function partitionAppointments(
  appointments: readonly LegacyAppointment[],
  cutoverAt: Date,
): AppointmentPartition {
  const cutoverMs = cutoverAt.getTime();
  if (Number.isNaN(cutoverMs)) {
    throw new Error('cutoverAt must be a valid timestamp');
  }

  const historical: LegacyAppointment[] = [];
  const excluded: LegacyAppointment[] = [];
  for (const appointment of appointments) {
    if (appointment.startsAt * 1_000 > cutoverMs) {
      excluded.push(appointment);
    } else {
      historical.push(appointment);
    }
  }
  return { historical, excluded };
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = stableValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function hashLegacyPayload(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex');
}
