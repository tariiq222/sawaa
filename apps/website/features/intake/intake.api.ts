import { publicFetch } from '@/lib/public-fetch';

/**
 * Field types as defined by the dashboard intake-forms editor.
 * `CHECKBOX` answers are `string[]`; every other type answers as `string`.
 */
export type IntakeFieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'DATE'
  | 'SELECT'
  | 'CHECKBOX'
  | 'RADIO';

export interface IntakeField {
  id: string;
  labelAr: string;
  labelEn: string;
  fieldType: IntakeFieldType;
  isRequired: boolean;
  options: string[] | null;
  position: number;
}

export interface IntakeForm {
  id: string;
  nameAr: string;
  nameEn: string;
  /** Lowercased form type, e.g. `pre_booking`, `pre_session`. */
  type: string;
  /** Lowercased scope, e.g. `service`, `employee`, `branch`, `global`. */
  scope: string;
  fields: IntakeField[];
}

/** Answer to a single field: a string for most types, string[] for CHECKBOX. */
export type IntakeAnswer = string | string[];

export interface IntakeResponsePayload {
  formId: string;
  answers: Record<string, IntakeAnswer>;
}

export interface FetchApplicableParams {
  serviceId: string;
  employeeId?: string;
  branchId?: string;
  /** Upper-case form type enum, e.g. `PRE_BOOKING`, `PRE_SESSION`. */
  type?: 'PRE_BOOKING' | 'PRE_SESSION' | 'POST_SESSION' | 'REGISTRATION';
}

/**
 * GET /public/intake-forms/applicable — active intake forms that apply to a
 * booking context. The client session cookie is sent automatically.
 */
export async function fetchApplicableIntakeForms(
  params: FetchApplicableParams,
): Promise<IntakeForm[]> {
  const query = new URLSearchParams();
  query.set('serviceId', params.serviceId);
  if (params.employeeId) query.set('employeeId', params.employeeId);
  if (params.branchId) query.set('branchId', params.branchId);
  if (params.type) query.set('type', params.type);

  const json = await publicFetch<unknown>(
    `/public/intake-forms/applicable?${query.toString()}`,
    { credentials: 'include', cache: 'no-store' },
  );

  const list = Array.isArray(json)
    ? json
    : ((json as { data?: unknown }).data ?? []);
  return (Array.isArray(list) ? list : []) as IntakeForm[];
}

/**
 * POST /public/bookings/:bookingId/intake-responses — submit answers for one
 * form. Throws `PublicFetchError(status, body)` on non-2xx.
 */
export async function submitIntakeResponse(
  bookingId: string,
  payload: IntakeResponsePayload,
): Promise<void> {
  await publicFetch<unknown>(
    `/public/bookings/${encodeURIComponent(bookingId)}/intake-responses`,
    {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(payload),
    },
  );
}
