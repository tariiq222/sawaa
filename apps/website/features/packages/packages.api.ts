import type {
  BookMyPackageCreditInput,
  ClientPackagePurchase,
  InitPackagePurchaseInput,
  InitPackagePurchaseResponse,
  PackageFamily,
} from '@sawaa/shared/types';
import { packageFamiliesApi, setMeBaseUrl } from '@sawaa/api-client';
import { publicFetch } from '@/lib/public-fetch';
import { getApiBase } from '@/lib/api-base';

let clientApiReady = false;
function ensureClientApi(): void {
  if (clientApiReady) return;
  setMeBaseUrl(getApiBase());
  clientApiReady = true;
}

export async function getPublicPackageFamilies(): Promise<PackageFamily[]> {
  const result = await publicFetch<PackageFamily[] | { data: PackageFamily[] }>(
    '/public/package-families',
    { cache: 'no-store' },
  );
  return result && typeof result === 'object' && 'data' in result ? result.data : result;
}

export async function getPublicPackageFamily(id: string): Promise<PackageFamily> {
  const result = await publicFetch<PackageFamily | { data: PackageFamily }>(
    `/public/package-families/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  );
  return result && typeof result === 'object' && 'data' in result ? result.data : result;
}

export function initClientPackagePurchase(
  input: InitPackagePurchaseInput,
): Promise<InitPackagePurchaseResponse> {
  ensureClientApi();
  return packageFamiliesApi.initPackagePurchase(input);
}

export function listClientPackagePurchases(): Promise<ClientPackagePurchase[]> {
  ensureClientApi();
  return packageFamiliesApi.listMyPackagePurchases();
}

export function getClientPackagePurchase(id: string): Promise<ClientPackagePurchase> {
  ensureClientApi();
  return packageFamiliesApi.getMyPackagePurchase(id);
}

export function bookClientPackageCredit(input: BookMyPackageCreditInput) {
  ensureClientApi();
  return packageFamiliesApi.bookMyPackageCredit(input);
}
