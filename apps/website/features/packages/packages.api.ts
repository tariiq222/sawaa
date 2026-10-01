import type {
  BookMyPackageCreditInput,
  ClientPackagePurchase,
  InitPackagePurchaseInput,
  InitPackagePurchaseResponse,
  PackageFamily,
} from '@sawaa/shared/types';
import { packageFamiliesApi, setMeBaseUrl } from '@sawaa/api-client';
import { grossWithVat } from '@/lib/money';
import { publicFetch } from '@/lib/public-fetch';
import { getApiBase } from '@/lib/api-base';

/**
 * Public package family as returned by `/public/package-families`. Option
 * prices stay NET; `vatRate` (fraction, e.g. 0 or 0.15) is the centre's current
 * VAT setting that is added on top at checkout. Older cached responses may
 * omit it — treat a missing value as 0.
 */
export type PublicPackageFamily = PackageFamily & { vatRate?: number };

/**
 * The client's own package purchase row. `amountPaid` is the NET package
 * price; `totalCharged` is the VAT-inclusive invoice total actually charged.
 * Older responses may omit the VAT fields.
 */
export type ClientPackagePurchaseRow = ClientPackagePurchase & {
  vatAmount?: number;
  totalCharged?: number;
};

/** VAT-inclusive amount (halalas) the client is charged for a net package price. */
export function packageGrossPrice(netHalalas: number, vatRate: number | undefined): number {
  return grossWithVat(netHalalas, vatRate ?? 0);
}

/** Amount the client actually paid for a purchase (halalas), VAT included. */
export function purchaseTotalCharged(purchase: ClientPackagePurchaseRow): number {
  return purchase.totalCharged ?? purchase.amountPaid;
}

let clientApiReady = false;
function ensureClientApi(): void {
  if (clientApiReady) return;
  setMeBaseUrl(getApiBase());
  clientApiReady = true;
}

export async function getPublicPackageFamilies(): Promise<PublicPackageFamily[]> {
  const result = await publicFetch<PublicPackageFamily[] | { data: PublicPackageFamily[] }>(
    '/public/package-families',
    { cache: 'no-store' },
  );
  return result && typeof result === 'object' && 'data' in result ? result.data : result;
}

export async function getPublicPackageFamily(id: string): Promise<PublicPackageFamily> {
  const result = await publicFetch<PublicPackageFamily | { data: PublicPackageFamily }>(
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

export function listClientPackagePurchases(): Promise<ClientPackagePurchaseRow[]> {
  ensureClientApi();
  return packageFamiliesApi.listMyPackagePurchases() as Promise<ClientPackagePurchaseRow[]>;
}

export function getClientPackagePurchase(id: string): Promise<ClientPackagePurchaseRow> {
  ensureClientApi();
  return packageFamiliesApi.getMyPackagePurchase(id) as Promise<ClientPackagePurchaseRow>;
}

export function bookClientPackageCredit(input: BookMyPackageCreditInput) {
  ensureClientApi();
  return packageFamiliesApi.bookMyPackageCredit(input);
}
