jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

import api from '../api';
import { paymentsService } from '../payments';

const mockedApi = api as unknown as { get: jest.Mock; post: jest.Mock };

describe('paymentsService', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    mockedApi.post.mockResolvedValue({ data: { success: true, data: {} } });
    mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });
  });

  it('creates a hosted (Moyasar) payment for the booking', async () => {
    await paymentsService.createMoyasarPayment({ bookingId: 'b-1', source: { type: 'creditcard' } });

    expect(mockedApi.post).toHaveBeenCalledWith('/payments/moyasar', {
      bookingId: 'b-1',
      source: { type: 'creditcard' },
    });
  });

  it('uploads a bank-transfer receipt as multipart with the booking id attached', async () => {
    await paymentsService.uploadBankTransferReceipt('b-2', 'file:///receipt.jpg');

    const [url, body, config] = mockedApi.post.mock.calls[0];
    expect(url).toBe('/payments/bank-transfer');
    expect(body).toBeInstanceOf(FormData);
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
  });

  it('lists the client payments with the requested filters', async () => {
    await paymentsService.getMyPayments({ page: 2, limit: 10, status: 'PENDING', method: 'moyasar' });

    expect(mockedApi.get).toHaveBeenCalledWith('/payments/my', {
      params: { page: 2, limit: 10, status: 'PENDING', method: 'moyasar' },
    });
  });

  it('reads the payment attached to a booking', async () => {
    await paymentsService.getPaymentByBooking('b-3');
    expect(mockedApi.get).toHaveBeenCalledWith('/payments/booking/b-3');
  });

  it('returns the response envelope unchanged', async () => {
    mockedApi.get.mockResolvedValue({ data: { success: true, data: [{ id: 'p-1' }] } });
    await expect(paymentsService.getMyPayments()).resolves.toEqual({
      success: true,
      data: [{ id: 'p-1' }],
    });
  });
});
