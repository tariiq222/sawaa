import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  MoyasarApiClient,
  MoyasarRefundStatus,
} from './moyasar-api.client';
import { PrismaService } from '../../../infrastructure/database';
import { MoyasarCredentialsService } from '../../../infrastructure/payments/moyasar-credentials.service';

jest.mock('../../../infrastructure/http', () => ({
  fetchWithTimeout: jest.fn(),
}));

import { fetchWithTimeout } from '../../../infrastructure/http';

const ORG_ID = 'org-test-123';

function makePrisma(secretKeyEnc: string | null = 'enc-key') {
  return {
    organizationPaymentConfig: {
      findUnique: jest.fn().mockResolvedValue(secretKeyEnc ? { secretKeyEnc } : null),
    },
  };
}

function makeCreds(secretKey = 'sk_live_abc') {
  return {
    decrypt: jest.fn().mockReturnValue({ secretKey }),
  };
}

describe('MoyasarApiClient', () => {
  let client: MoyasarApiClient;
  let prisma: ReturnType<typeof makePrisma>;
  let creds: ReturnType<typeof makeCreds>;

  beforeEach(async () => {
    prisma = makePrisma();
    creds = makeCreds();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoyasarApiClient,
        { provide: PrismaService, useValue: prisma },
        { provide: MoyasarCredentialsService, useValue: creds },
      ],
    }).compile();

    client = module.get<MoyasarApiClient>(MoyasarApiClient);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getApiKeyForOrg', () => {
    it('returns cached key without hitting DB on cache hit', async () => {
      // Prime cache by calling once
      await (client as unknown as { getApiKeyForOrg(id: string): Promise<string> }).getApiKeyForOrg(ORG_ID);
      expect(prisma.organizationPaymentConfig.findUnique).toHaveBeenCalledTimes(1);
      expect(creds.decrypt).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      // Second call should be a cache hit
      const key = await (client as unknown as { getApiKeyForOrg(id: string): Promise<string> }).getApiKeyForOrg(ORG_ID);
      expect(key).toBe('sk_live_abc');
      expect(prisma.organizationPaymentConfig.findUnique).not.toHaveBeenCalled();
      expect(creds.decrypt).not.toHaveBeenCalled();
    });

    it('fetches from DB + decrypts + caches on cache miss', async () => {
      const key = await (client as unknown as { getApiKeyForOrg(id: string): Promise<string> }).getApiKeyForOrg(ORG_ID);
      expect(key).toBe('sk_live_abc');
      expect(prisma.organizationPaymentConfig.findUnique).toHaveBeenCalledTimes(1);
      expect(creds.decrypt).toHaveBeenCalledWith('enc-key', ORG_ID);
    });

    it('throws BadRequestException when DB returns no config', async () => {
      prisma.organizationPaymentConfig.findUnique.mockResolvedValue(null);
      await expect(
        (client as unknown as { getApiKeyForOrg(id: string): Promise<string> }).getApiKeyForOrg('org-no-config'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('request', () => {
    it('returns JSON when response.ok is true', async () => {
      (fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'pay_123' }),
      });

      const result = await (client as unknown as { request<T>(org: string, path: string, opts: RequestInit): Promise<T> }).request(
        ORG_ID,
        '/payments',
        { method: 'GET' },
      );

      expect(result).toEqual({ id: 'pay_123' });
      expect(fetchWithTimeout).toHaveBeenCalledWith(
        'https://api.moyasar.com/v1/payments',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Basic c2tfbGl2ZV9hYmM6',
            'Content-Type': 'application/json',
          }),
        }),
        15_000,
      );
    });

    it('throws InternalServerErrorException with parsed error message when !response.ok and JSON parse succeeds', async () => {
      (fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Invalid card', type: 'error', status: 400 }),
      });

      await expect(
        (client as unknown as { request<T>(org: string, path: string, opts: RequestInit): Promise<T> }).request(
          ORG_ID,
          '/payments',
          { method: 'POST', body: '{}' },
        ),
      ).rejects.toThrow(InternalServerErrorException);

      await expect(
        (client as unknown as { request<T>(org: string, path: string, opts: RequestInit): Promise<T> }).request(
          ORG_ID,
          '/payments',
          { method: 'POST', body: '{}' },
        ),
      ).rejects.toThrow('Moyasar API error: Invalid card (status: 400)');
    });

    it('throws InternalServerErrorException with statusText fallback when !response.ok and JSON parse fails', async () => {
      (fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new Error('parse failed');
        },
      });

      await expect(
        (client as unknown as { request<T>(org: string, path: string, opts: RequestInit): Promise<T> }).request(
          ORG_ID,
          '/payments',
          { method: 'GET' },
        ),
      ).rejects.toThrow('Moyasar API error: Bad Gateway (status: 502)');
    });
  });

  describe('hosted checkout invoices', () => {
    const hostedInvoiceResponse = {
      id: 'inv_hosted_123',
      status: 'initiated',
      amount: 12500,
      currency: 'SAR',
      description: 'Sawaa invoice #42',
      url: 'https://moyasar.com/invoices/inv_hosted_123',
      success_url: 'https://sawaa.example/payments/success',
      back_url: 'https://sawaa.example/payments/cancel',
      metadata: {
        internalPaymentId: 'payment/with spaces',
        invoiceId: 'invoice-42',
      },
      payments: [
        { id: 'pay_hosted_123', status: 'paid' },
      ],
    };

    it('creates a hosted invoice with Basic auth, the exact gateway body, and hosted URL mapping', async () => {
      (fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => hostedInvoiceResponse,
      });

      const result = await client.createCheckoutInvoice(ORG_ID, {
        amountHalalas: 12500,
        currency: 'SAR',
        description: 'Sawaa invoice #42',
        successUrl: 'https://sawaa.example/payments/success',
        backUrl: 'https://sawaa.example/payments/cancel',
        metadata: {
          internalPaymentId: 'payment/with spaces',
          invoiceId: 'invoice-42',
        },
      });

      expect(result).toEqual({
        id: 'inv_hosted_123',
        status: 'initiated',
        amount: 12500,
        currency: 'SAR',
        url: 'https://moyasar.com/invoices/inv_hosted_123',
        metadata: {
          internalPaymentId: 'payment/with spaces',
          invoiceId: 'invoice-42',
        },
        payments: [{ id: 'pay_hosted_123', status: 'paid' }],
      });
      expect(fetchWithTimeout).toHaveBeenCalledWith(
        'https://api.moyasar.com/v1/invoices',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            amount: 12500,
            currency: 'SAR',
            description: 'Sawaa invoice #42',
            success_url: 'https://sawaa.example/payments/success',
            back_url: 'https://sawaa.example/payments/cancel',
            metadata: {
              internalPaymentId: 'payment/with spaces',
              invoiceId: 'invoice-42',
            },
          }),
          headers: expect.objectContaining({
            Authorization: 'Basic c2tfbGl2ZV9hYmM6',
            'Content-Type': 'application/json',
          }),
        }),
        15_000,
      );
    });

    it('fetches and maps one hosted invoice by gateway id', async () => {
      (fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ ...hostedInvoiceResponse, status: 'paid' }),
      });

      await expect(
        client.getCheckoutInvoice(ORG_ID, 'inv_hosted_123'),
      ).resolves.toEqual({
        id: 'inv_hosted_123',
        status: 'paid',
        amount: 12500,
        currency: 'SAR',
        url: 'https://moyasar.com/invoices/inv_hosted_123',
        metadata: hostedInvoiceResponse.metadata,
        payments: [{ id: 'pay_hosted_123', status: 'paid' }],
      });
      expect(fetchWithTimeout).toHaveBeenCalledWith(
        'https://api.moyasar.com/v1/invoices/inv_hosted_123',
        expect.objectContaining({ method: 'GET' }),
        15_000,
      );
    });

    it('finds the first hosted invoice by URL-encoded internalPaymentId metadata', async () => {
      (fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [hostedInvoiceResponse],
      });

      await expect(
        client.findCheckoutInvoiceByMetadata(ORG_ID, 'payment/with spaces'),
      ).resolves.toEqual({
        id: 'inv_hosted_123',
        status: 'initiated',
        amount: 12500,
        currency: 'SAR',
        url: 'https://moyasar.com/invoices/inv_hosted_123',
        metadata: hostedInvoiceResponse.metadata,
        payments: [{ id: 'pay_hosted_123', status: 'paid' }],
      });
      expect(fetchWithTimeout).toHaveBeenCalledWith(
        'https://api.moyasar.com/v1/invoices?metadata%5BinternalPaymentId%5D=payment%2Fwith+spaces',
        expect.objectContaining({ method: 'GET' }),
        15_000,
      );
    });

    it('returns null when no hosted invoice matches the metadata filter', async () => {
      (fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      await expect(
        client.findCheckoutInvoiceByMetadata(ORG_ID, 'missing-payment'),
      ).resolves.toBeNull();
    });
  });

  describe('createRefund', () => {
    it('builds body, calls request, and maps response', async () => {
      (fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pay_123',
          amount: 1000,
          currency: 'SAR',
          status: 'refunded',
          refunded: 500,
          updated_at: '2024-01-02T00:00:00Z',
        }),
      });

      const result = await client.createRefund(ORG_ID, {
        paymentId: 'pay_123',
        amount: 500,
      } as never);

      expect(result).toEqual({
        id: 'pay_123',
        amount: 500,
        refunded: 500,
        currency: 'SAR',
        status: 'refunded',
        paymentId: 'pay_123',
        createdAt: '2024-01-02T00:00:00Z',
      });

      expect(fetchWithTimeout).toHaveBeenCalledWith(
        'https://api.moyasar.com/v1/payments/pay_123/refund',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ amount: 500 }),
          headers: expect.not.objectContaining({ 'Idempotency-Key': expect.anything() }),
        }),
        15_000,
      );
      const requestOptions = (fetchWithTimeout as jest.Mock).mock.calls.at(-1)[1];
      expect(requestOptions.headers).not.toHaveProperty('Idempotency-Key');
    });
  });

  describe('getRefundStatus', () => {
    // After the fix, getRefundStatus re-fetches GET /payments/:id and derives
    // refund status from the payment object's status field.
    const cases: Array<{ paymentStatus: string; expected: MoyasarRefundStatus }> = [
      { paymentStatus: 'refunded', expected: 'paid' },
      { paymentStatus: 'failed', expected: 'failed' },
      { paymentStatus: 'voided', expected: 'failed' },
      { paymentStatus: 'initiated', expected: 'pending' },
      { paymentStatus: 'paid', expected: 'pending' },
      { paymentStatus: 'unknown', expected: 'pending' },
    ];

    it.each(cases)('maps payment status "$paymentStatus" to refund status "$expected"', async ({ paymentStatus, expected }) => {
      (fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'ref_123',
          status: paymentStatus,
          amount: 1000,
          currency: 'SAR',
        }),
      });

      const result = await client.getRefundStatus(ORG_ID, 'ref_123');
      expect(result).toEqual({ id: 'ref_123', status: expected });

      expect(fetchWithTimeout).toHaveBeenCalledWith(
        'https://api.moyasar.com/v1/payments/ref_123',
        expect.objectContaining({ method: 'GET' }),
        15_000,
      );
    });
  });

  describe('getPaymentStatus', () => {
    it('fetches GET /payments/:id and retains cumulative refunded halalas', async () => {
      (fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pay_123',
          status: 'paid',
          amount: 12000,
          refunded: 3500,
          currency: 'SAR',
        }),
      });

      const result = await client.getPaymentStatus(ORG_ID, 'pay_123');

      expect(result).toEqual({
        id: 'pay_123',
        status: 'paid',
        amount: 12000,
        refunded: 3500,
        currency: 'SAR',
      });

      expect(fetchWithTimeout).toHaveBeenCalledWith(
        'https://api.moyasar.com/v1/payments/pay_123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Basic c2tfbGl2ZV9hYmM6',
            'Content-Type': 'application/json',
          }),
        }),
        15_000,
      );
    });

    it('returns the Moyasar status verbatim (e.g. authorized)', async () => {
      (fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pay_a',
          status: 'authorized',
          amount: 500,
          currency: 'SAR',
        }),
      });

      const result = await client.getPaymentStatus(ORG_ID, 'pay_a');
      expect(result.status).toBe('authorized');
    });

    it('maps the hosted invoice id exposed by the payment fetch response', async () => {
      (fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pay_hosted_123',
          status: 'paid',
          amount: 12500,
          refunded: 0,
          currency: 'SAR',
          invoice_id: 'inv_hosted_123',
        }),
      });

      await expect(
        client.getPaymentStatus(ORG_ID, 'pay_hosted_123'),
      ).resolves.toEqual({
        id: 'pay_hosted_123',
        status: 'paid',
        amount: 12500,
        refunded: 0,
        currency: 'SAR',
        invoiceId: 'inv_hosted_123',
      });
    });

    it('throws NotFoundException when Moyasar returns 404 (payment does not exist)', async () => {
      (fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Payment not found', type: 'error', status: 404 }),
      });

      await expect(client.getPaymentStatus(ORG_ID, 'pay_missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws InternalServerErrorException on a 5xx (transient — caller should retry)', async () => {
      (fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => ({ message: 'upstream error', type: 'error', status: 502 }),
      });

      await expect(client.getPaymentStatus(ORG_ID, 'pay_x')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('invalidate', () => {
    it('removes the cached key so the next call re-fetches from DB', async () => {
      const getKey = (id: string) =>
        (client as unknown as { getApiKeyForOrg(id: string): Promise<string> }).getApiKeyForOrg(id);

      await getKey(ORG_ID);
      expect(prisma.organizationPaymentConfig.findUnique).toHaveBeenCalledTimes(1);

      client.invalidate(ORG_ID);
      jest.clearAllMocks();

      await getKey(ORG_ID);
      expect(prisma.organizationPaymentConfig.findUnique).toHaveBeenCalledTimes(1);
      expect(creds.decrypt).toHaveBeenCalledTimes(1);
    });
  });
});
