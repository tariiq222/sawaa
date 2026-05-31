import { describe, it, expect, vi, beforeEach } from 'vitest';

const publicFetchMock = vi.fn();

vi.mock('@/lib/public-fetch', () => {
  class FakePublicFetchError extends Error {
    constructor(
      public readonly status: number,
      public readonly body: unknown,
    ) {
      super(`PublicFetchError: ${status}`);
      this.name = 'PublicFetchError';
    }
  }
  return {
    publicFetch: (path: string, init?: RequestInit) => publicFetchMock(path, init),
    PublicFetchError: FakePublicFetchError,
  };
});

import { PublicFetchError } from '@/lib/public-fetch';
import {
  fetchApplicableIntakeForms,
  submitIntakeResponse,
  type IntakeForm,
} from './intake.api';

const sampleForm: IntakeForm = {
  id: 'form_1',
  nameAr: 'نموذج',
  nameEn: 'Form',
  type: 'pre_booking',
  scope: 'service',
  fields: [
    {
      id: 'f1',
      labelAr: 'الاسم',
      labelEn: 'Name',
      fieldType: 'TEXT',
      isRequired: true,
      options: null,
      position: 0,
    },
  ],
};

describe('intake.api — fetchApplicableIntakeForms', () => {
  beforeEach(() => publicFetchMock.mockReset());

  it('GETs /public/intake-forms/applicable with serviceId only', async () => {
    publicFetchMock.mockResolvedValue([sampleForm]);
    const result = await fetchApplicableIntakeForms({ serviceId: 'svc1' });
    const [path, init] = publicFetchMock.mock.calls[0];
    expect(path).toBe('/public/intake-forms/applicable?serviceId=svc1');
    expect(init).toMatchObject({ credentials: 'include', cache: 'no-store' });
    expect(result).toEqual([sampleForm]);
  });

  it('includes employeeId, branchId, and type query params when provided', async () => {
    publicFetchMock.mockResolvedValue([]);
    await fetchApplicableIntakeForms({
      serviceId: 'svc1',
      employeeId: 'emp1',
      branchId: 'br1',
      type: 'PRE_SESSION',
    });
    const [path] = publicFetchMock.mock.calls[0];
    expect(path).toContain('serviceId=svc1');
    expect(path).toContain('employeeId=emp1');
    expect(path).toContain('branchId=br1');
    expect(path).toContain('type=PRE_SESSION');
  });

  it('unwraps { data: [...] } envelopes and tolerates non-array payloads', async () => {
    publicFetchMock.mockResolvedValueOnce({ data: [sampleForm] });
    expect(await fetchApplicableIntakeForms({ serviceId: 'svc1' })).toEqual([sampleForm]);
    publicFetchMock.mockResolvedValueOnce({ unexpected: true });
    expect(await fetchApplicableIntakeForms({ serviceId: 'svc1' })).toEqual([]);
  });
});

describe('intake.api — submitIntakeResponse', () => {
  beforeEach(() => publicFetchMock.mockReset());

  it('POSTs the formId + answers to the by-booking endpoint', async () => {
    publicFetchMock.mockResolvedValue({});
    await submitIntakeResponse('bk1', {
      formId: 'form_1',
      answers: { f1: 'hi', f2: ['a', 'b'] },
    });
    const [path, init] = publicFetchMock.mock.calls[0];
    expect(path).toBe('/public/bookings/bk1/intake-responses');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body)).toEqual({
      formId: 'form_1',
      answers: { f1: 'hi', f2: ['a', 'b'] },
    });
  });

  it('URL-encodes the booking id', async () => {
    publicFetchMock.mockResolvedValue({});
    await submitIntakeResponse('a/b c', { formId: 'form_1', answers: {} });
    const [path] = publicFetchMock.mock.calls[0];
    expect(path).toContain(encodeURIComponent('a/b c'));
  });

  it('propagates PublicFetchError from a non-2xx response', async () => {
    publicFetchMock.mockRejectedValueOnce(new PublicFetchError(422, { message: 'bad' }));
    await expect(
      submitIntakeResponse('bk1', { formId: 'form_1', answers: {} }),
    ).rejects.toThrow('PublicFetchError: 422');
  });
});
