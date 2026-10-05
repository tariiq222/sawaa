import type { InitPackagePurchaseInput, NativePackagePurchaseInitResponse } from '@sawaa/shared/types';
import { getSessionEpoch, isSessionCurrent } from '@/services/native-session-state';
import { APP_SCHEME } from '@/constants/config';
import {
  clearPackagePurchaseAttemptKey,
  clientPackagesService,
  getPackagePurchaseAttemptKey,
  savePendingPackagePurchase,
} from '@/services/client/packages';
import { isPaidAttemptKeyError } from './package-utils';

/** Retained for callbacks from previously released hosted checkouts. */
export const PACKAGE_CHECKOUT_RETURN_URL = `${APP_SCHEME}://packages/return`;

export interface PackageCheckoutTarget {
  clientId: string;
  packageId: string;
  /** Empty string for a standalone package. */
  familyId: string;
  branchId: string;
}

export interface PackageCheckoutResult {
  purchaseId: string;
  invoiceId: string;
}

type InitPurchase = (input: InitPackagePurchaseInput) => Promise<NativePackagePurchaseInitResponse>;

async function initWithAttemptKey(init: InitPurchase, target: PackageCheckoutTarget, epoch: number) {
  const familyId = target.familyId || undefined;
  const assertCurrent = () => { if (!isSessionCurrent(epoch)) throw new Error('Session changed during package checkout'); };
  const request = async () => {
    assertCurrent();
    const idempotencyKey = await getPackagePurchaseAttemptKey(target.clientId, target.packageId, familyId, target.branchId, () => isSessionCurrent(epoch));
    assertCurrent();
    return init({ packageId: target.packageId, ...(familyId ? { packageFamilyId: familyId } : {}), branchId: target.branchId, idempotencyKey });
  };
  try {
    return await request();
  } catch (error) {
    assertCurrent();
    const data = (error as { response?: { data?: { code?: string; purchaseId?: string } } })?.response?.data;
    if ((!isPaidAttemptKeyError(error) && data?.code !== 'PAYMENT_ALREADY_COMPLETED') || !data?.purchaseId) throw error;
    // A provider result alone never permits a second purchase. Read the old
    // purchase through the authenticated API and verify its frozen target.
    const purchase = await clientPackagesService.getPurchase(data.purchaseId);
    assertCurrent();
    if (purchase.id !== data.purchaseId || purchase.packageId !== target.packageId
      || purchase.branchId !== target.branchId || (purchase.packageFamilyId ?? '') !== target.familyId
      || !['ACTIVE', 'COMPLETED'].includes(purchase.status)) throw error;
    await clearPackagePurchaseAttemptKey(target.clientId, target.packageId, familyId, target.branchId);
    return request();
  }
}

/** Reserve or resume one native attempt; the native screen reconciles it. */
export async function runPackageCheckout(init: InitPurchase, target: PackageCheckoutTarget): Promise<PackageCheckoutResult> {
  const epoch = getSessionEpoch();
  const result = await initWithAttemptKey(init, target, epoch);
  await savePendingPackagePurchase({ purchaseId: result.purchaseId, invoiceId: result.invoiceId, ...target });
  if (!isSessionCurrent(epoch)) throw new Error('Session changed during package checkout');
  return { purchaseId: result.purchaseId, invoiceId: result.invoiceId };
}
