const mockOpenAuthSession = jest.fn();
const mockGetKey = jest.fn();
const mockClearKey = jest.fn(async (..._args: unknown[]) => undefined);
const mockSavePending = jest.fn(async (..._args: unknown[]) => undefined);

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSession(...args) }));
jest.mock('@/services/client/packages', () => ({
  getPackagePurchaseAttemptKey: (...args: unknown[]) => mockGetKey(...args),
  clearPackagePurchaseAttemptKey: (...args: unknown[]) => mockClearKey(...args),
  savePendingPackagePurchase: (...args: unknown[]) => mockSavePending(...args),
}));

import { PACKAGE_CHECKOUT_RETURN_URL, runPackageCheckout } from '../package-checkout';

const target = { clientId: 'client-1', packageId: 'package-1', familyId: '', branchId: 'branch-1' };
const response = { purchaseId: 'purchase-1', invoiceId: 'invoice-1', paymentId: 'payment-1', redirectUrl: 'https://pay.example/inv' };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetKey.mockResolvedValue('key-1');
});

it('reuses the stored attempt key, saves the pending purchase, and reports a closed page', async () => {
  const init = jest.fn(async () => response);
  mockOpenAuthSession.mockResolvedValue({ type: 'cancel' });

  await expect(runPackageCheckout(init, target)).resolves.toEqual({ purchaseId: 'purchase-1', signal: 'closed' });
  expect(init).toHaveBeenCalledWith({ packageId: 'package-1', branchId: 'branch-1', idempotencyKey: 'key-1' });
  expect(mockSavePending).toHaveBeenCalledWith({ purchaseId: 'purchase-1', ...target });
  expect(mockOpenAuthSession).toHaveBeenCalledWith(response.redirectUrl, PACKAGE_CHECKOUT_RETURN_URL);
});

it('reads a declined status from the gateway redirect', async () => {
  mockOpenAuthSession.mockResolvedValue({ type: 'success', url: `${PACKAGE_CHECKOUT_RETURN_URL}?id=p&status=failed&message=Declined` });
  await expect(runPackageCheckout(jest.fn(async () => response), target)).resolves.toEqual({ purchaseId: 'purchase-1', signal: 'failed' });
});

it('rotates a key whose purchase was already paid and starts a new purchase once', async () => {
  const paid = { response: { status: 400, data: { message: 'This purchase has already been paid' } } };
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
