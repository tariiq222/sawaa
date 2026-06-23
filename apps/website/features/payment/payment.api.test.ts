import { describe, it, expect, vi, beforeEach } from 'vitest';

// Re-export surface check + delegation test for the small payment.api barrel.
const initGuestPaymentMock = vi.fn();

vi.mock('@/features/booking/booking.api', () => ({
  initGuestPayment: (...args: unknown[]) => initGuestPaymentMock(...args),
}));

// Import AFTER the mock so the re-export picks up the mock.
import { initGuestPayment } from './payment.api';

describe('payment.api', () => {
  beforeEach(() => {
    initGuestPaymentMock.mockReset();
    initGuestPaymentMock.mockResolvedValue({
      paymentId: 'pay_1',
      redirectUrl: 'https://moyasar.test/pay_1',
    });
  });

  it('re-exports initGuestPayment and forwards the call to the booking API', async () => {
    const result = await initGuestPayment('inv_1');
    expect(initGuestPaymentMock).toHaveBeenCalledWith('inv_1');
    expect(result).toEqual({
      paymentId: 'pay_1',
      redirectUrl: 'https://moyasar.test/pay_1',
    });
  });

  it('propagates errors from the underlying booking API call', async () => {
    initGuestPaymentMock.mockRejectedValueOnce(new Error('Invoice not found'));
    await expect(initGuestPayment('missing')).rejects.toThrow('Invoice not found');
  });
});
