let mockSessionEpoch = 1;
jest.mock('@/services/native-session-state', () => ({ getSessionEpoch: () => mockSessionEpoch, isSessionCurrent: (epoch: number) => epoch === mockSessionEpoch }));
const mockOpenAuthSession = jest.fn();
const mockGetPurchase = jest.fn();
const mockGetPending = jest.fn();
const mockGetKey = jest.fn();
const mockClearKey = jest.fn(async (..._args: unknown[]) => undefined);
const mockSavePending = jest.fn(async (..._args: unknown[]) => undefined);

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSession(...args) }));
jest.mock('@/services/client/packages', () => ({
  clientPackagesService: { getPurchase: (...args: unknown[]) => mockGetPurchase(...args) },
  getPendingPackagePurchase: (...args: unknown[]) => mockGetPending(...args),
  getPackagePurchaseAttemptKey: (...args: unknown[]) => mockGetKey(...args),
  clearPackagePurchaseAttemptKey: (...args: unknown[]) => mockClearKey(...args),
  savePendingPackagePurchase: (...args: unknown[]) => mockSavePending(...args),
}));

import { runPackageCheckout } from '../package-checkout';

const target = { clientId: 'client-1', packageId: 'package-1', familyId: '', branchId: 'branch-1' };
const response = { purchaseId: 'purchase-1', invoiceId: 'invoice-1', paymentId: 'payment-1', config: { enabled: true, isLive: false, supportedNetworks: ['mada', 'visa', 'mastercard'] as ('mada' | 'visa' | 'mastercard')[], applePay: null, publishableKey: 'pk_test', givenId: 'id-1', amount: 100, currency: 'SAR', description: 'Package' } };

beforeEach(() => {
  jest.clearAllMocks();
  mockSessionEpoch = 1;
  mockGetKey.mockResolvedValue('key-1');
  mockGetPurchase.mockResolvedValue({ id: 'old-purchase', packageId: 'package-1', branchId: 'branch-1', packageFamilyId: null, status: 'ACTIVE' });
  mockGetPending.mockResolvedValue(null);
});

it('reserves native checkout with the stored attempt key and keeps frozen target identity', async () => {
  const init = jest.fn(async () => response);
  await expect(runPackageCheckout(init, target)).resolves.toEqual({ purchaseId: 'purchase-1', invoiceId: 'invoice-1' });
  expect(init).toHaveBeenCalledWith({ packageId: 'package-1', branchId: 'branch-1', idempotencyKey: 'key-1' });
  expect(mockSavePending).toHaveBeenCalledWith({ purchaseId: 'purchase-1', invoiceId: 'invoice-1', ...target });
  expect(mockOpenAuthSession).not.toHaveBeenCalled();
  expect(mockClearKey).not.toHaveBeenCalled();
});

it('rotates a key whose purchase was already paid and starts a new purchase once', async () => {
  const paid = { response: { status: 400, data: { message: 'This purchase has already been paid', purchaseId: 'old-purchase', code: 'PAYMENT_ALREADY_COMPLETED' } } };
  const init = jest.fn().mockRejectedValueOnce(paid).mockResolvedValueOnce(response);
  mockGetKey.mockResolvedValueOnce('old-key').mockResolvedValueOnce('new-key');
  mockOpenAuthSession.mockResolvedValue({ type: 'dismiss' });

  await runPackageCheckout(init, target);
  expect(mockClearKey).toHaveBeenCalledWith('client-1', 'package-1', undefined, 'branch-1');
  expect(init).toHaveBeenLastCalledWith(expect.objectContaining({ idempotencyKey: 'new-key' }));
});

it('does not rotate the key on a pending-checkout conflict', async () => {
  const conflict = { response: { status: 409, data: { message: 'Another checkout is already pending for this client and package' } } };
  const init = jest.fn().mockRejectedValue(conflict);
  await expect(runPackageCheckout(init, target)).rejects.toBe(conflict);
  expect(init).toHaveBeenCalledTimes(1);
  expect(mockClearKey).not.toHaveBeenCalled();
  expect(mockSavePending).not.toHaveBeenCalled();
});

it.each(['PENDING', 'REFUNDED'])('does not renew a paid key until authenticated purchase is activated (%s)', async (status) => {
  mockGetPurchase.mockResolvedValue({ id: 'old-purchase', packageId: 'package-1', branchId: 'branch-1', packageFamilyId: null, status });
  const error = { response: { status: 409, data: { code: 'PAYMENT_ALREADY_COMPLETED', purchaseId: 'old-purchase' } } };
  await expect(runPackageCheckout(jest.fn().mockRejectedValue(error), target)).rejects.toBe(error);
  expect(mockClearKey).not.toHaveBeenCalled();
});

it('refuses to rotate a paid attempt for a different frozen target', async () => {
  mockGetPurchase.mockResolvedValue({ id: 'old-purchase', packageId: 'other-package', branchId: 'branch-1', packageFamilyId: null, status: 'ACTIVE' });
  const error = { response: { status: 409, data: { code: 'PAYMENT_ALREADY_COMPLETED', purchaseId: 'old-purchase' } } };
  await expect(runPackageCheckout(jest.fn().mockRejectedValue(error), target)).rejects.toBe(error);
  expect(mockClearKey).not.toHaveBeenCalled();
});

it('does not initialize under a new session after a deferred attempt-key read', async () => {
  let finish!: (value: string) => void;
  mockGetKey.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const init = jest.fn(async () => response);
  const pending = runPackageCheckout(init, target);
  mockSessionEpoch = 2;
  finish('old-key');
  await expect(pending).rejects.toThrow('Session changed');
  expect(init).not.toHaveBeenCalled();
  expect(mockClearKey).not.toHaveBeenCalled();
});

it('does not rotate or request again after session changes during paid-purchase lookup', async () => {
  let finish!: (value: object) => void;
  mockGetPurchase.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const error = { response: { data: { code: 'PAYMENT_ALREADY_COMPLETED', purchaseId: 'old-purchase' } } };
  const init = jest.fn().mockRejectedValue(error);
  const pending = runPackageCheckout(init, target);
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  mockSessionEpoch = 2;
  finish({ id: 'old-purchase', packageId: 'package-1', branchId: 'branch-1', packageFamilyId: null, status: 'ACTIVE' });
  await expect(pending).rejects.toThrow('Session changed');
  expect(mockClearKey).not.toHaveBeenCalled();
  expect(init).toHaveBeenCalledTimes(1);
});
