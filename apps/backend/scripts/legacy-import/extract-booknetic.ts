import { chmod, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { createPool, type RowDataPacket } from 'mysql2/promise';
import {
  hashLegacyPayload,
  validateLegacyBundle,
} from '../../src/modules/ops/legacy-import/legacy-import.bundle';
import type {
  LegacyAppointment,
  LegacyAppointmentCustomData,
  LegacyAppointmentStatus,
  LegacyBundleV1,
  LegacyCustomer,
  LegacyForm,
  LegacyFormInput,
  LegacyFormInputChoice,
  LegacyLocation,
  LegacyService,
  LegacyServiceCategory,
  LegacyStaff,
} from '../../src/modules/ops/legacy-import/legacy-import.types';

interface AppointmentRow extends RowDataPacket {
  id: number;
  location_id: number;
  service_id: number;
  staff_id: number;
  customer_id: number;
  starts_at: number;
  ends_at: number;
  status: LegacyAppointmentStatus;
  payment_method: string | null;
  payment_status: string | null;
  paid_amount: string;
  note: string | null;
  created_at: number | null;
}

interface CustomerRow extends RowDataPacket {
  id: number;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  email: string | null;
  birthdate: string | null;
  notes: string | null;
  gender: string | null;
  created_at: string | null;
}

interface StaffRow extends RowDataPacket {
  id: number;
  name: string;
  email: string | null;
  phone_number: string | null;
  profession: string | null;
  is_active: number;
}

interface ServiceRow extends RowDataPacket {
  id: number;
  category_id: number | null;
  name: string;
  price: string;
  duration: number;
  is_active: number;
}

interface NamedRow extends RowDataPacket {
  id: number;
  name: string;
}

interface FormRow extends RowDataPacket {
  id: number;
  name: string;
  service_ids: string | null;
}

interface FormInputRow extends RowDataPacket {
  id: number;
  form_id: number;
  type: string;
  label: string;
  is_required: number;
  order_number: number;
}

interface ChoiceRow extends RowDataPacket {
  id: number;
  form_input_id: number;
  title: string;
  order_number: number;
}

interface CustomDataRow extends RowDataPacket {
  id: number;
  appointment_id: number;
  form_input_id: number;
  input_value: string | null;
  input_file_name: string | null;
}

function parseArgs(argv: readonly string[]): { tenant: number; output: string } {
  let tenant: number | undefined;
  let output: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    } else if (arg === '--tenant') {
      tenant = Number(argv[++index]);
    } else if (arg === '--output') {
      output = argv[++index];
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (tenant !== 6) throw new Error('--tenant must be exactly 6');
  if (!output) throw new Error('--output is required');
  return { tenant, output: isAbsolute(output) ? output : resolve(output) };
}

async function main(): Promise<void> {
  const { tenant, output } = parseArgs(process.argv.slice(2));
  const legacyDatabaseUrl = process.env.LEGACY_DATABASE_URL;
  if (!legacyDatabaseUrl) throw new Error('LEGACY_DATABASE_URL is required');

  const pool = createPool({
    uri: legacyDatabaseUrl,
    connectionLimit: 2,
    decimalNumbers: false,
    dateStrings: true,
  });

  try {
    const [appointmentRows] = await pool.query<AppointmentRow[]>(
      `SELECT id, location_id, service_id, staff_id, customer_id,
              starts_at, ends_at, status, payment_method, payment_status,
              CAST(paid_amount AS CHAR) AS paid_amount, note, created_at
         FROM vue_bkntc_appointments
        WHERE tenant_id = ?
        ORDER BY id`,
      [tenant],
    );

    const [customerRows] = await pool.query<CustomerRow[]>(
      `SELECT DISTINCT c.id, c.first_name, c.last_name, c.phone_number,
              c.email, c.birthdate, c.notes, c.gender, c.created_at
         FROM vue_bkntc_customers c
         JOIN vue_bkntc_appointments a ON a.customer_id = c.id
        WHERE a.tenant_id = ? AND c.tenant_id = ?
        ORDER BY c.id`,
      [tenant, tenant],
    );
    const [staffRows] = await pool.query<StaffRow[]>(
      `SELECT DISTINCT s.id, s.name, s.email, s.phone_number,
              s.profession, s.is_active
         FROM vue_bkntc_staff s
         JOIN vue_bkntc_appointments a ON a.staff_id = s.id
        WHERE a.tenant_id = ? AND s.tenant_id = ?
        ORDER BY s.id`,
      [tenant, tenant],
    );
    const [serviceRows] = await pool.query<ServiceRow[]>(
      `SELECT DISTINCT s.id, s.category_id, s.name,
              CAST(s.price AS CHAR) AS price, s.duration, s.is_active
         FROM vue_bkntc_services s
         JOIN vue_bkntc_appointments a ON a.service_id = s.id
        WHERE a.tenant_id = ? AND s.tenant_id = ?
        ORDER BY s.id`,
      [tenant, tenant],
    );
    const [categoryRows] = await pool.query<NamedRow[]>(
      `SELECT DISTINCT c.id, c.name
         FROM vue_bkntc_service_categories c
         JOIN vue_bkntc_services s ON s.category_id = c.id
         JOIN vue_bkntc_appointments a ON a.service_id = s.id
        WHERE a.tenant_id = ? AND c.tenant_id = ?
        ORDER BY c.id`,
      [tenant, tenant],
    );
    const [locationRows] = await pool.query<NamedRow[]>(
      `SELECT DISTINCT l.id, l.name
         FROM vue_bkntc_locations l
         JOIN vue_bkntc_appointments a ON a.location_id = l.id
        WHERE a.tenant_id = ? AND l.tenant_id = ?
        ORDER BY l.id`,
      [tenant, tenant],
    );
    const [customDataRows] = await pool.query<CustomDataRow[]>(
      `SELECT d.id, d.appointment_id, d.form_input_id,
              d.input_value, d.input_file_name
         FROM vue_bkntc_appointment_custom_data d
         JOIN vue_bkntc_appointments a ON a.id = d.appointment_id
        WHERE a.tenant_id = ?
        ORDER BY d.id`,
      [tenant],
    );
    const [formInputRows] = await pool.query<FormInputRow[]>(
      `SELECT DISTINCT i.id, i.form_id, i.type, i.label,
              i.is_required, i.order_number
         FROM vue_bkntc_form_inputs i
         JOIN vue_bkntc_appointment_custom_data d ON d.form_input_id = i.id
         JOIN vue_bkntc_appointments a ON a.id = d.appointment_id
        WHERE a.tenant_id = ?
        ORDER BY i.id`,
      [tenant],
    );
    const [formRows] = await pool.query<FormRow[]>(
      `SELECT DISTINCT f.id, f.name, f.service_ids
         FROM vue_bkntc_forms f
         JOIN vue_bkntc_form_inputs i ON i.form_id = f.id
         JOIN vue_bkntc_appointment_custom_data d ON d.form_input_id = i.id
         JOIN vue_bkntc_appointments a ON a.id = d.appointment_id
        WHERE a.tenant_id = ? AND f.tenant_id = ?
        ORDER BY f.id`,
      [tenant, tenant],
    );
    const [choiceRows] = await pool.query<ChoiceRow[]>(
      `SELECT DISTINCT c.id, c.form_input_id, c.title, c.order_number
         FROM vue_bkntc_form_input_choices c
         JOIN vue_bkntc_form_inputs i ON i.id = c.form_input_id
         JOIN vue_bkntc_appointment_custom_data d ON d.form_input_id = i.id
         JOIN vue_bkntc_appointments a ON a.id = d.appointment_id
        WHERE a.tenant_id = ?
        ORDER BY c.id`,
      [tenant],
    );

    const appointments: LegacyAppointment[] = appointmentRows.map((row) => ({
      id: row.id,
      locationId: row.location_id,
      serviceId: row.service_id,
      staffId: row.staff_id,
      customerId: row.customer_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      paidAmount: row.paid_amount,
      note: row.note,
      createdAt: row.created_at,
    }));
    const customers: LegacyCustomer[] = customerRows.map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone_number,
      email: row.email,
      birthdate: row.birthdate,
      notes: row.notes,
      gender: row.gender,
      createdAt: row.created_at,
    }));
    const staff: LegacyStaff[] = staffRows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone_number,
      profession: row.profession,
      isActive: row.is_active === 1,
    }));
    const services: LegacyService[] = serviceRows.map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      price: row.price,
      duration: row.duration,
      isActive: row.is_active === 1,
    }));
    const serviceCategories: LegacyServiceCategory[] = categoryRows.map(
      (row) => ({ id: row.id, name: row.name }),
    );
    const locations: LegacyLocation[] = locationRows.map((row) => ({
      id: row.id,
      name: row.name,
    }));
    const forms: LegacyForm[] = formRows.map((row) => ({
      id: row.id,
      name: row.name,
      serviceIds: row.service_ids,
    }));
    const formInputs: LegacyFormInput[] = formInputRows.map((row) => ({
      id: row.id,
      formId: row.form_id,
      type: row.type,
      label: row.label,
      isRequired: row.is_required === 1,
      orderNumber: row.order_number,
    }));
    const formInputChoices: LegacyFormInputChoice[] = choiceRows.map((row) => ({
      id: row.id,
      formInputId: row.form_input_id,
      title: row.title,
      orderNumber: row.order_number,
    }));
    const appointmentCustomData: LegacyAppointmentCustomData[] =
      customDataRows.map((row) => ({
        id: row.id,
        appointmentId: row.appointment_id,
        formInputId: row.form_input_id,
        inputValue: row.input_value,
        inputFileName: row.input_file_name,
      }));

    const bundle: LegacyBundleV1 = {
      schemaVersion: 1,
      sourceSystem: 'booknetic',
      sourceTenant: 6,
      extractedAt: new Date().toISOString(),
      counts: {
        appointments: appointments.length,
        customers: customers.length,
        staff: staff.length,
        services: services.length,
        locations: locations.length,
        customData: appointmentCustomData.length,
      },
      appointments,
      customers,
      staff,
      services,
      serviceCategories,
      locations,
      forms,
      formInputs,
      formInputChoices,
      appointmentCustomData,
    };

    validateLegacyBundle(bundle);
    await writeFile(output, `${JSON.stringify(bundle)}\n`, { mode: 0o600 });
    await chmod(output, 0o600);

    const report = {
      output,
      sha256: hashLegacyPayload(bundle),
      counts: bundle.counts,
      forms: bundle.forms.length,
      formInputs: bundle.formInputs.length,
      formInputChoices: bundle.formInputChoices.length,
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown extraction error';
  process.stderr.write(`legacy extraction failed: ${message}\n`);
  process.exitCode = 1;
});
