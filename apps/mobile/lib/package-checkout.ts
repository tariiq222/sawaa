import * as WebBrowser from 'expo-web-browser';
import type { InitPackagePurchaseInput, InitPackagePurchaseResponse } from '@sawaa/shared/types';

import { APP_SCHEME } from '@/constants/config';
import {
  clearPackagePurchaseAttemptKey,
  getPackagePurchaseAttemptKey,
  savePendingPackagePurchase,
} from '@/services/client/packages';
import {
  isPaidAttemptKeyError,
  packageCheckoutSignalFromBrowser,
  packageCheckoutSignalFromRedirect,
  parseQueryParams,
  type PackageCheckoutSignal,
} from './package-utils';

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
  signal: PackageCheckoutSignal;
}

type InitPurchase = (input: InitPackagePurchaseInput) => Promise<InitPackagePurchaseResponse>;

async function initWithAttemptKey(init: InitPurchase, target: PackageCheckoutTarget) {
  const familyId = target.familyId || undefined;
  const request = async () => {
    const idempotencyKey = await getPackagePurchaseAttemptKey(target.clientId, target.packageId, familyId, target.branchId);
    return init({
      packageId: target.packageId,
      ...(familyId ? { packageFamilyId: familyId } : {}),
      branchId: target.branchId,
      idempotencyKey,
    });
  };
  try {
    // Reusing the stored key lets the backend hand back the still-open
    // checkout (or replace a declined/expired one) for the same purchase.
    return await request();
  } catch (error) {
    if (!isPaidAttemptKeyError(error)) throw error;
    // The earlier attempt was paid after this device stopped watching it; a
    // new purchase of the same package needs a fresh key.
    await clearPackagePurchaseAttemptKey(target.clientId, target.packageId, familyId, target.branchId);
    return request();
  }
}

/**
 * Starts (or resumes) hosted package checkout and reports what the browser
 * told us. It never decides that payment succeeded: the return screen reads
 * activation from the authenticated API.
 */
export async function runPackageCheckout(init: InitPurchase, target: PackageCheckoutTarget): Promise<PackageCheckoutResult> {
  const result = await initWithAttemptKey(init, target);
  await savePendingPackagePurchase({ purchaseId: result.purchaseId, ...target });
  const browser = await WebBrowser.openAuthSessionAsync(result.redirectUrl, PACKAGE_CHECKOUT_RETURN_URL);
  let signal = packageCheckoutSignalFromBrowser(browser?.type);
  if (browser?.type === 'success') {
    signal = packageCheckoutSignalFromRedirect(parseQueryParams(browser.url).status);
  }
  return { purchaseId: result.purchaseId, signal };
}
