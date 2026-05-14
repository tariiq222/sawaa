jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import api from '../api';
import { clientPaymentsService } from './payments';

const mockedApi = api as unknown as { post: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('clientPaymentsService.initPayment', () => {
  it('POSTs the invoice id and method to the mobile payment init endpoint', async () => {
    const payload = {
      paymentId: 'pay-1',
      redirectUrl: 'https://checkout.moyasar.com/pay/pay-1',
    };
    mockedApi.post.mockResolvedValueOnce({ data: payload });

    const result = await clientPaymentsService.initPayment('inv-1', 'APPLE_PAY');

    expect(result).toEqual(payload);
    expect(mockedApi.post).toHaveBeenCalledWith(
      '/mobile/client/payments/init',
      { invoiceId: 'inv-1', method: 'APPLE_PAY' },
    );
  });
});
