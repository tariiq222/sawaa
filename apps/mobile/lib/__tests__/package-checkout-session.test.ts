let mockEpoch = 1;
const mockStorage = new Map<string, string>();
jest.mock('@/services/native-session-state', () => ({ getSessionEpoch: () => mockEpoch, isSessionCurrent: (epoch: number) => epoch === mockEpoch }));
jest.mock('@/services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('expo-modules-core', () => ({ uuid: { v4: () => 'attempt-1' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: async (key: string) => mockStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => { mockStorage.set(key, value); },
  removeItem: async (key: string) => { mockStorage.delete(key); },
} }));
import { runPackageCheckout } from '../package-checkout';
import { getPendingPackagePurchase, savePendingPackagePurchase } from '@/services/client/packages';
import type { NativePackagePurchaseInitResponse } from '@sawaa/shared/types';

it('preserves late A response in its own namespace and rejects stale completion after B starts', async () => {
  const target = { clientId: 'A', packageId: 'p', familyId: '', branchId: 'b' };
  let finish!: (result: NativePackagePurchaseInitResponse) => void;
  let dispatched!: () => void;
  const dispatchSignal = new Promise<void>((resolve) => { dispatched = resolve; });
  const init = jest.fn(() => { dispatched(); return new Promise<NativePackagePurchaseInitResponse>((resolve) => { finish = resolve; }); });
  const checkout = runPackageCheckout(init, target);
  await dispatchSignal;
  mockEpoch += 1;
  const b = { ...target, clientId: 'B', purchaseId: 'purchase-B', invoiceId: 'invoice-B' };
  await savePendingPackagePurchase(b);
  finish({ purchaseId: 'purchase-A', invoiceId: 'invoice-A' } as NativePackagePurchaseInitResponse);
  await expect(checkout).rejects.toThrow('Session changed');
  expect(await getPendingPackagePurchase('B')).toEqual(b);
  expect(await getPendingPackagePurchase('A')).toEqual({ ...target, purchaseId: 'purchase-A', invoiceId: 'invoice-A' });
  expect(init).toHaveBeenCalledTimes(1);
});
