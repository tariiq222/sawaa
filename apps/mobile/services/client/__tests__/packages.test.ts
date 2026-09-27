jest.mock('../../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import api from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clientPackagesService,
  clearPendingPackagePurchase,
  getPendingPackagePurchase,
  getPackagePurchaseAttemptKey,
  packagePurchaseAttemptStorageKey,
  savePendingPackagePurchase,
} from '../packages';

const mockedApi = api as unknown as { get: jest.Mock; post: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('clientPackagesService catalog and purchase calls', () => {
  it('loads the public family catalog and preserves option counts and totals', async () => {
    const payload = [{
      id: 'family-1',
      nameAr: 'جلسات أسرية',
      nameEn: 'Family sessions',
      isStandalone: false,
      options: [
        { id: 'offer-5', nameAr: 'خمس جلسات', sessionCount: 5, price: { subtotal: 100000, discountAmount: 10000, finalPrice: 90000 } },
        { id: 'offer-9', nameAr: 'تسع جلسات', sessionCount: 9, price: { subtotal: 180000, discountAmount: 20000, finalPrice: 160000 } },
      ],
    }];
    mockedApi.get.mockResolvedValueOnce({ data: payload });

    const result = await clientPackagesService.listFamilies();

    expect(result).toEqual(payload);
    expect(result[0].options.map((option) => option.sessionCount)).toEqual([5, 9]);
    expect(result[0].options.map((option) => option.price.finalPrice)).toEqual([90000, 160000]);
    expect(mockedApi.get).toHaveBeenCalledWith('/public/package-families');
  });

  it('initializes checkout with the selected offer and family ids', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { purchaseId: 'purchase-1', invoiceId: 'invoice-1', paymentId: 'payment-1', redirectUrl: 'https://pay.test/1' } });

    await clientPackagesService.initPurchase({
      packageId: 'offer-9',
      packageFamilyId: 'family-1',
      branchId: 'branch-1',
      idempotencyKey: 'attempt-1',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/public/payments/package-purchases/init', {
      packageId: 'offer-9',
      packageFamilyId: 'family-1',
      branchId: 'branch-1',
      idempotencyKey: 'attempt-1',
    });
  });
});

describe('clientPackagesService authenticated balance and booking calls', () => {
  it('reads only the authenticated client purchase balance and pending status', async () => {
    mockedApi.get
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: { id: 'purchase-1', status: 'PENDING', credits: [] } });

    await clientPackagesService.listPurchases();
    await clientPackagesService.getPurchase('purchase-1');

    expect(mockedApi.get).toHaveBeenNthCalledWith(1, '/mobile/client/packages/purchases');
    expect(mockedApi.get).toHaveBeenNthCalledWith(2, '/mobile/client/packages/purchases/purchase-1');
  });

  it('books an available credit with server-resolved identity and selected time', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'booking-1', status: 'PENDING', packageCreditId: 'credit-1' } });

    await clientPackagesService.bookCredit({
      creditId: 'credit-1',
      branchId: 'branch-1',
      scheduledAt: '2026-09-20T10:00:00.000Z',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/mobile/client/packages/book', {
      creditId: 'credit-1',
      branchId: 'branch-1',
      scheduledAt: '2026-09-20T10:00:00.000Z',
    });
  });

  it('reuses one idempotency key for an uncertain retry scoped to client, offer, family, and branch', async () => {
    const storage = AsyncStorage as unknown as {
      getItem: jest.Mock;
      setItem: jest.Mock;
    };
    const values = new Map<string, string>();
    storage.getItem.mockImplementation(async (key: string) => values.get(key) ?? null);
    storage.setItem.mockImplementation(async (key: string, value: string) => {
      values.set(key, value);
    });

    const first = await getPackagePurchaseAttemptKey('client-1', 'offer-9', 'family-1', 'branch-1');
    const retry = await getPackagePurchaseAttemptKey('client-1', 'offer-9', 'family-1', 'branch-1');

    expect(first).toBe(retry);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith(
      packagePurchaseAttemptStorageKey('client-1', 'offer-9', 'family-1', 'branch-1'),
      first,
    );
  });

  it('fails before storing a purchase attempt when secure randomness is unavailable', async () => {
    const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    const storage = AsyncStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock };
    storage.getItem.mockResolvedValue(null);
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
    try {
      await expect(getPackagePurchaseAttemptKey('client-1', 'offer-9', 'family-1', 'branch-1'))
        .rejects.toThrow('Secure random generation');
      expect(storage.setItem).not.toHaveBeenCalled();
    } finally {
      if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
      else Reflect.deleteProperty(globalThis, 'crypto');
    }
  });

  it('persists the purchase before opening hosted payment so a killed app can recover status', async () => {
    const storage = AsyncStorage as unknown as {
      getItem: jest.Mock;
      setItem: jest.Mock;
      removeItem: jest.Mock;
    };
    const values = new Map<string, string>();
    storage.getItem.mockImplementation(async (key: string) => values.get(key) ?? null);
    storage.setItem.mockImplementation(async (key: string, value: string) => values.set(key, value));
    storage.removeItem.mockImplementation(async (key: string) => { values.delete(key); });

    await savePendingPackagePurchase({
      purchaseId: 'purchase-1',
      clientId: 'client-1',
      packageId: 'offer-9',
      familyId: 'family-1',
      branchId: 'branch-1',
    });
    expect(await getPendingPackagePurchase()).toEqual({
      purchaseId: 'purchase-1',
      clientId: 'client-1',
      packageId: 'offer-9',
      familyId: 'family-1',
      branchId: 'branch-1',
    });
    await clearPendingPackagePurchase();
    expect(await getPendingPackagePurchase()).toBeNull();
  });
});
