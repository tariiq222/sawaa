jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import api from '../api';
import { clientPaymentsService, getReceiptUploadMetadata } from './payments';

const mockedApi = api as unknown as { post: jest.Mock };

class RecordingFormData {
  readonly parts: Array<[string, unknown]> = [];

  append(name: string, value: unknown) {
    this.parts.push([name, value]);
  }
}

const nativeFormData = global.FormData;

beforeEach(() => {
  jest.clearAllMocks();
  global.FormData = RecordingFormData as unknown as typeof FormData;
});

afterAll(() => {
  global.FormData = nativeFormData;
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

describe('receipt upload metadata', () => {
  it('preserves a picker PNG mime type and filename', () => {
    expect(getReceiptUploadMetadata({
      uri: 'file:///receipts/transfer.png',
      mimeType: 'image/png',
      fileName: 'transfer.png',
    })).toEqual({ type: 'image/png', name: 'transfer.png' });
  });

  it('falls back to a known JPEG URI extension', () => {
    expect(getReceiptUploadMetadata({ uri: 'file:///receipts/transfer.jpeg' }))
      .toEqual({ type: 'image/jpeg', name: 'transfer.jpeg' });
  });

  it('rejects a receipt whose type cannot be safely identified', () => {
    expect(() => getReceiptUploadMetadata({ uri: 'file:///receipts/transfer' }))
      .toThrow('Unsupported receipt file type');
  });

  it('sends the selected metadata to the bank transfer endpoint', async () => {
    const response = { id: 'payment-1' };
    mockedApi.post.mockResolvedValueOnce({ data: response });

    await clientPaymentsService.uploadBankTransfer('invoice-1', 12500, {
      uri: 'file:///receipts/transfer.png',
      mimeType: 'image/png',
      fileName: 'transfer.png',
    });

    const formData = mockedApi.post.mock.calls[0][1] as unknown as RecordingFormData;
    const parts = formData.parts;
    expect(parts).toEqual([
      ['invoiceId', 'invoice-1'],
      ['amount', '12500'],
      ['receipt', { uri: 'file:///receipts/transfer.png', type: 'image/png', name: 'transfer.png' }],
    ]);
    expect(mockedApi.post.mock.calls[0][0]).toBe('/mobile/client/payments/bank-transfer');
  });
});
