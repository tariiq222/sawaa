jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import api from '../api';
import { clientPaymentsService, getMyInvoicePdfUrl, getReceiptUploadMetadata, listMyInvoices, requestRefund } from './payments';

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
      '/client/payments/init',
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
      '/client/payments/bank-transfer/settings',
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
    expect(mockedApi.post.mock.calls[0][0]).toBe('/client/payments/bank-transfer');
  });
});


describe('native payment API boundaries', () => {
  it('loads native capabilities without making a payable attempt', async () => {
    jest.mocked(api.get).mockResolvedValueOnce({ data: { enabled: true } });
    expect(await clientPaymentsService.getNativeConfig()).toEqual({ enabled: true });
    expect(api.get).toHaveBeenCalledWith('/client/payments/native/config');
    expect(api.post).not.toHaveBeenCalled();
  });
  it('initializes using only the invoice and chosen method', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { paymentId: 'payment' } });
    await clientPaymentsService.initNativePayment('invoice', 'ONLINE_CARD');
    expect(api.post).toHaveBeenCalledWith('/client/payments/native/init', { invoiceId: 'invoice', method: 'ONLINE_CARD' });
  });
  it('reconciles identity only without SDK result or amount', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { status: 'PENDING' } });
    expect(await clientPaymentsService.reconcileNativePayment('payment')).toEqual({ status: 'PENDING' });
    expect(api.post).toHaveBeenCalledWith('/client/payments/native/payment/reconcile');
  });
});

describe('invoices and refunds (unified client API)', () => {
  const get = api.get as jest.Mock;
  const post = api.post as jest.Mock;

  it('lists invoices with pageSize pagination', async () => {
    const data = { items: [], total: 0, page: 2, pageSize: 5, outstandingBalance: 1200 };
    get.mockResolvedValueOnce({ data });
    await expect(listMyInvoices({ page: 2, pageSize: 5 })).resolves.toEqual(data);
    expect(get).toHaveBeenCalledWith('/client/invoices', { params: { page: 2, pageSize: 5 } });
  });

  it('fetches the presigned receipt URL', async () => {
    get.mockResolvedValueOnce({ data: { url: 'https://signed' } });
    await expect(getMyInvoicePdfUrl('inv 1')).resolves.toEqual({ url: 'https://signed' });
    expect(get).toHaveBeenCalledWith('/client/invoices/inv%201/pdf');
  });

  it('posts a refund request', async () => {
    post.mockResolvedValueOnce({ data: { id: 'r1' } });
    await expect(requestRefund({ invoiceId: 'inv-1', reason: 'duplicate' })).resolves.toEqual({ id: 'r1' });
    expect(post).toHaveBeenCalledWith('/client/refunds/request', { invoiceId: 'inv-1', reason: 'duplicate' });
  });

  it('maps list limit to pageSize', async () => {
    get.mockResolvedValueOnce({ data: { items: [], total: 0, page: 1, pageSize: 10 } });
    await clientPaymentsService.list({ page: 1, limit: 10 });
    expect(get).toHaveBeenCalledWith('/client/payments', { params: { page: 1, pageSize: 10 } });
  });

  it('reads the canonical { items, total, page, pageSize } envelope into meta', async () => {
    get.mockResolvedValueOnce({ data: { items: [{ id: 'p1' }], total: 25, page: 2, pageSize: 10 } });
    const r = await clientPaymentsService.list({ page: 2, limit: 10 });
    expect(r.items).toEqual([{ id: 'p1' }]);
    expect(r.meta).toEqual({ total: 25, page: 2, perPage: 10, totalPages: 3, hasNextPage: true, hasPreviousPage: true });
  });

  it('still accepts the legacy { items, meta } envelope', async () => {
    get.mockResolvedValueOnce({ data: { items: [], meta: { total: 5, page: 1, limit: 5, totalPages: 1 } } });
    const r = await clientPaymentsService.list();
    expect(r.meta).toMatchObject({ total: 5, page: 1, perPage: 5, totalPages: 1, hasNextPage: false });
  });
});
