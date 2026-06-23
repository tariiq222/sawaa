import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  setMeBaseUrlMock,
  updateMyProfileMock,
  getMyInvoicesMock,
  requestRefundMock,
  getApiBaseMock,
} = vi.hoisted(() => ({
  setMeBaseUrlMock: vi.fn(),
  updateMyProfileMock: vi.fn(),
  getMyInvoicesMock: vi.fn(),
  requestRefundMock: vi.fn(),
  getApiBaseMock: vi.fn(() => 'http://api.local/api/v1'),
}));

vi.mock('@sawaa/api-client', () => ({
  setMeBaseUrl: setMeBaseUrlMock,
  updateMyProfile: updateMyProfileMock,
  getMyInvoices: getMyInvoicesMock,
  requestRefund: requestRefundMock,
}));

vi.mock('@/lib/api-base', () => ({
  getApiBase: getApiBaseMock,
}));

import {
  updateMyProfileApi,
  getMyInvoicesApi,
  requestRefundApi,
} from './account.api';

const fakeProfile = {
  id: 'c1',
  name: 'Sara',
  email: 'sara@test.com',
  phone: '+966500000000',
  emailVerified: '2026-01-01T00:00:00.000Z',
  phoneVerified: null,
  accountType: 'REGISTERED' as const,
  claimedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const fakeInvoices = {
  items: [
    {
      id: 'inv_1',
      number: 1,
      bookingId: 'bk1',
      serviceName: 'جلسة',
      scheduledAt: '2026-05-01T10:00:00Z',
      subtotal: 10000,
      discountAmt: 0,
      vatRate: 0.15,
      vatAmt: 1500,
      total: 11500,
      refundedAmount: 0,
      refundedVatAmt: 0,
      currency: 'SAR',
      status: 'PAID' as const,
      issuedAt: '2026-05-01T10:00:00Z',
      paidAt: '2026-05-01T10:05:00Z',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 50,
};

describe('account.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiBaseMock.mockReturnValue('http://api.local/api/v1');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('initialisation', () => {
    it('calls setMeBaseUrl exactly once on the first call and reuses it for later calls', async () => {
      updateMyProfileMock.mockResolvedValue(fakeProfile);
      getMyInvoicesMock.mockResolvedValue(fakeInvoices);
      requestRefundMock.mockResolvedValue({ ok: true });

      await updateMyProfileApi({ name: 'New' });
      await getMyInvoicesApi();
      await requestRefundApi('inv_1', 'reason');

      expect(setMeBaseUrlMock).toHaveBeenCalledTimes(1);
      expect(setMeBaseUrlMock).toHaveBeenCalledWith('http://api.local/api/v1');
    });
  });

  describe('updateMyProfileApi', () => {
    it('forwards the payload to updateMyProfile', async () => {
      updateMyProfileMock.mockResolvedValue(fakeProfile);
      await updateMyProfileApi({ name: 'Updated', phone: '+966500000001' });
      expect(updateMyProfileMock).toHaveBeenCalledWith({
        name: 'Updated',
        phone: '+966500000001',
      });
    });

    it('returns the updated ClientProfile from updateMyProfile', async () => {
      updateMyProfileMock.mockResolvedValue({ ...fakeProfile, name: 'Updated' });
      await expect(updateMyProfileApi({ name: 'Updated' })).resolves.toEqual({
        ...fakeProfile,
        name: 'Updated',
      });
    });

    it('propagates errors from updateMyProfile', async () => {
      updateMyProfileMock.mockRejectedValue(new Error('Conflict'));
      await expect(updateMyProfileApi({ email: 'taken@sawa.test' })).rejects.toThrow(
        'Conflict',
      );
    });
  });

  describe('getMyInvoicesApi', () => {
    it('forwards default pagination 1 / 50 to getMyInvoices', async () => {
      getMyInvoicesMock.mockResolvedValue(fakeInvoices);
      await getMyInvoicesApi();
      expect(getMyInvoicesMock).toHaveBeenCalledWith(1, 50);
    });

    it('forwards custom pagination parameters', async () => {
      getMyInvoicesMock.mockResolvedValue({ ...fakeInvoices, page: 3, pageSize: 25 });
      await getMyInvoicesApi(3, 25);
      expect(getMyInvoicesMock).toHaveBeenCalledWith(3, 25);
    });

    it('returns the full ClientInvoiceListResponse envelope from getMyInvoices', async () => {
      getMyInvoicesMock.mockResolvedValue(fakeInvoices);
      await expect(getMyInvoicesApi()).resolves.toEqual(fakeInvoices);
    });
  });

  describe('requestRefundApi', () => {
    it('forwards invoiceId and reason to requestRefund', async () => {
      requestRefundMock.mockResolvedValue({ ok: true });
      await requestRefundApi('inv_1', 'changed my mind');
      expect(requestRefundMock).toHaveBeenCalledWith('inv_1', 'changed my mind');
    });

    it('forwards invoiceId without a reason when none is provided', async () => {
      requestRefundMock.mockResolvedValue({ ok: true });
      await requestRefundApi('inv_1');
      expect(requestRefundMock).toHaveBeenCalledWith('inv_1', undefined);
    });

    it('returns the backend response verbatim (no envelope unwrapping)', async () => {
      requestRefundMock.mockResolvedValue({ ok: true, refundId: 'rf_1' });
      await expect(requestRefundApi('inv_1', 'reason')).resolves.toEqual({
        ok: true,
        refundId: 'rf_1',
      });
    });

    it('propagates errors from requestRefund', async () => {
      requestRefundMock.mockRejectedValue(new Error('Invoice not refundable'));
      await expect(requestRefundApi('inv_1')).rejects.toThrow('Invoice not refundable');
    });
  });
});
