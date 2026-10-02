import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuid } from 'expo-modules-core';
import type {
  BookMyPackageCreditInput,
  ClientPackagePurchase,
  InitPackagePurchaseInput,
  InitPackagePurchaseResponse,
} from '@sawaa/shared/types';
import type { PackageFamily } from '@sawaa/shared/types';

import api from '../api';

/**
 * Public package family as the API returns it. `vatRate` is the centre's VAT
 * fraction (0 when VAT is off or the field is missing); option prices are NET.
 */
export type ClientPackageFamily = PackageFamily & { vatRate?: number };

/**
 * Client purchase row. `amountPaid` is NET; `vatAmount` and `totalCharged`
 * (VAT-inclusive) are halalas. Missing values mean 0 VAT / `amountPaid`.
 */
export type ClientPackagePurchaseRow = ClientPackagePurchase & { vatAmount?: number; totalCharged?: number };

const ATTEMPT_STORAGE_PREFIX = 'sawaa.package-purchase.attempt';
const PENDING_PURCHASE_STORAGE_KEY = 'sawaa.package-purchase.pending';

export interface PendingPackagePurchase {
  purchaseId: string;
  clientId: string;
  packageId: string;
  familyId: string;
  branchId: string;
}

export function packagePurchaseAttemptStorageKey(
  clientId: string,
  packageId: string,
  packageFamilyId: string | undefined,
  branchId: string,
): string {
  return [ATTEMPT_STORAGE_PREFIX, clientId, packageId, packageFamilyId ?? 'standalone', branchId].join(':');
}

function newAttemptId(): string {
  try {
    return uuid.v4();
  } catch {
    throw new Error('Secure random generation is required for package purchases');
  }
}

/**
 * Returns the same key after an uncertain hosted-payment retry. Keeping the
 * key scoped to the client, selected offer, family, and branch lets the API
 * safely replay an interrupted init request without creating a second sale.
 */
export async function getPackagePurchaseAttemptKey(
  clientId: string,
  packageId: string,
  packageFamilyId: string | undefined,
  branchId: string,
): Promise<string> {
  const storageKey = packagePurchaseAttemptStorageKey(clientId, packageId, packageFamilyId, branchId);
  const existing = await AsyncStorage.getItem(storageKey);
  if (existing) return existing;
  const attempt = newAttemptId();
  await AsyncStorage.setItem(storageKey, attempt);
  return attempt;
}

export async function clearPackagePurchaseAttemptKey(
  clientId: string,
  packageId: string,
  packageFamilyId: string | undefined,
  branchId: string,
): Promise<void> {
  await AsyncStorage.removeItem(packagePurchaseAttemptStorageKey(clientId, packageId, packageFamilyId, branchId));
}

export async function savePendingPackagePurchase(pending: PendingPackagePurchase): Promise<void> {
  await AsyncStorage.setItem(PENDING_PURCHASE_STORAGE_KEY, JSON.stringify(pending));
}

export async function getPendingPackagePurchase(): Promise<PendingPackagePurchase | null> {
  const value = await AsyncStorage.getItem(PENDING_PURCHASE_STORAGE_KEY);
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<PendingPackagePurchase>;
    if (!candidate.purchaseId || !candidate.clientId || !candidate.packageId || !candidate.branchId) return null;
    return {
      purchaseId: candidate.purchaseId,
      clientId: candidate.clientId,
      packageId: candidate.packageId,
      familyId: candidate.familyId ?? '',
      branchId: candidate.branchId,
    };
  } catch {
    return null;
  }
}

export async function clearPendingPackagePurchase(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_PURCHASE_STORAGE_KEY);
}

export const clientPackagesService = {
  async listFamilies(): Promise<ClientPackageFamily[]> {
    const response = await api.get<ClientPackageFamily[]>('/public/package-families');
    return response.data;
  },

  async getFamily(id: string): Promise<ClientPackageFamily> {
    const response = await api.get<ClientPackageFamily>(`/public/package-families/${id}`);
    return response.data;
  },

  async initPurchase(input: InitPackagePurchaseInput): Promise<InitPackagePurchaseResponse> {
    const response = await api.post<InitPackagePurchaseResponse>(
      '/mobile/client/payments/package-purchases/init',
      input,
    );
    return response.data;
  },

  async listPurchases(): Promise<ClientPackagePurchaseRow[]> {
    const response = await api.get<ClientPackagePurchaseRow[]>('/mobile/client/packages/purchases');
    return response.data;
  },

  async getPurchase(id: string): Promise<ClientPackagePurchaseRow> {
    const response = await api.get<ClientPackagePurchaseRow>(`/mobile/client/packages/purchases/${id}`);
    return response.data;
  },

  async bookCredit(input: BookMyPackageCreditInput) {
    const response = await api.post('/mobile/client/packages/book', input);
    return response.data;
  },
};
