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

describe('clientPaymentsService.getBankTransferSettings', () => {
  it('loads only the bank-transfer settings exposed to the signed-in client', async () => {
    const settings = {
      enabled: true,
      accounts: [{ id: 'bank-1', label: 'Main', bankName: 'Bank', beneficiaryName: 'Sawa', iban: 'SA0380000000608010167519' }],
    };
    (mockedApi as unknown as { get: jest.Mock }).get.mockResolvedValueOnce({ data: settings });

    await expect(clientPaymentsService.getBankTransferSettings()).resolves.toEqual(settings);
    expect((mockedApi as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
      '/mobile/client/payments/bank-transfer/settings',
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


describe('native payment API boundaries', () => {
  it('loads native capabilities without making a payable attempt', async () => {
    jest.mocked(api.get).mockResolvedValueOnce({ data: { enabled: true } });
    expect(await clientPaymentsService.getNativeConfig()).toEqual({ enabled: true });
    expect(api.get).toHaveBeenCalledWith('/mobile/client/payments/native/config');
    expect(api.post).not.toHaveBeenCalled();
  });
  it('initializes using only the invoice and chosen method', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { paymentId: 'payment' } });
    await clientPaymentsService.initNativePayment('invoice', 'ONLINE_CARD');
    expect(api.post).toHaveBeenCalledWith('/mobile/client/payments/native/init', { invoiceId: 'invoice', method: 'ONLINE_CARD' });
  });
  it('reconciles identity only without SDK result or amount', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { status: 'PENDING' } });
    expect(await clientPaymentsService.reconcileNativePayment('payment')).toEqual({ status: 'PENDING' });
    expect(api.post).toHaveBeenCalledWith('/mobile/client/payments/native/payment/reconcile');
  });
});
