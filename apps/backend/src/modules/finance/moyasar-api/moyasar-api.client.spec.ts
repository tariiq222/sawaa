import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { MoyasarApiClient, MoyasarCreatePaymentParams, MoyasarRefundStatus } from './moyasar-api.client';
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
            Authorization: 'Bearer sk_live_abc',
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

  describe('createPayment', () => {
    it('builds body, calls request, and maps response', async () => {
      (fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pay_123',
          object: 'payment',
          amount: 1000,
          currency: 'SAR',
          status: 'initiated',
          description: 'Invoice #1',
          metadata: { invoiceId: 'inv_1' },
          redirect_url: 'https://example.com/callback',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        }),
      });

      const params: MoyasarCreatePaymentParams = {
        amountHalalas: 1000,
        currency: 'SAR',
        description: 'Invoice #1',
        callbackUrl: 'https://example.com/callback',
        metadata: { invoiceId: 'inv_1' },
        givenId: 'idem-123',
      };

      const result = await client.createPayment(ORG_ID, params);

      expect(result).toEqual({
        id: 'pay_123',
        amount: 1000,
        currency: 'SAR',
        status: 'initiated',
        description: 'Invoice #1',
        metadata: { invoiceId: 'inv_1' },
        redirectUrl: 'https://example.com/callback',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      expect(fetchWithTimeout).toHaveBeenCalledWith(
        'https://api.moyasar.com/v1/payments',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            amount: 1000,
            currency: 'SAR',
            description: 'Invoice #1',
            callback_url: 'https://example.com/callback',
            metadata: { invoiceId: 'inv_1' },
            source: { type: 'card' },
            given_id: 'idem-123',
          }),
          headers: expect.objectContaining({
            Authorization: 'Bearer sk_live_abc',
            'Content-Type': 'application/json',
          }),
        }),
        15_000,
      );
    });
  });

  describe('toPaymentStatus', () => {
    const cases: Array<{ input: Parameters<MoyasarApiClient['toPaymentStatus']>[0]; expected: PaymentStatus }> = [
      { input: 'paid', expected: PaymentStatus.COMPLETED },
      { input: 'failed', expected: PaymentStatus.FAILED },
      { input: 'refunded', expected: PaymentStatus.REFUNDED },
      { input: 'initiated', expected: PaymentStatus.PENDING },
      { input: 'unknown' as any, expected: PaymentStatus.PENDING },
    ];

    it.each(cases)('maps $input to $expected', ({ input, expected }) => {
      expect(client.toPaymentStatus(input)).toBe(expected);
    });
  });

  describe('toPaymentMethod', () => {
    it('returns ONLINE_CARD', () => {
      expect(client.toPaymentMethod()).toBe(PaymentMethod.ONLINE_CARD);
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
        idempotencyKey: 'idem-refund-123',
      });

      expect(result).toEqual({
        id: 'pay_123',
        amount: 500,
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
          headers: expect.objectContaining({
            'Idempotency-Key': 'idem-refund-123',
            Authorization: 'Bearer sk_live_abc',
            'Content-Type': 'application/json',
          }),
        }),
        15_000,
      );
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
    it('fetches GET /payments/:id and maps id, status, amount, currency', async () => {
      (fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pay_123',
          status: 'paid',
          amount: 12000,
          currency: 'SAR',
        }),
      });

      const result = await client.getPaymentStatus(ORG_ID, 'pay_123');

      expect(result).toEqual({
        id: 'pay_123',
        status: 'paid',
        amount: 12000,
        currency: 'SAR',
      });

      expect(fetchWithTimeout).toHaveBeenCalledWith(
        'https://api.moyasar.com/v1/payments/pay_123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk_live_abc',
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
