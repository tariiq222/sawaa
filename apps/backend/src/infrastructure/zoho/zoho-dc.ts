/**
 * Zoho data-center routing.
 *
 * Zoho hosts each customer's data in a regional DC; the OAuth `accounts.zoho.<dc>`
 * host and the API `www.zohoapis.<dc>` host MUST match the DC the user signed
 * up under. The DC is supplied by the user during the Connect flow and then
 * persisted (encrypted) so subsequent calls hit the right region.
 *
 * Authoritative list:
 *   https://www.zoho.com/crm/developer/docs/api/v3/multi-dc.html
 *
 * KSA tenants must use `sa` (data residency requirement).
 */

export const ZOHO_DATA_CENTERS = ['com', 'sa', 'eu', 'in', 'au', 'jp', 'ca'] as const;

export type ZohoDataCenter = (typeof ZOHO_DATA_CENTERS)[number];

export function isZohoDataCenter(value: string): value is ZohoDataCenter {
  return (ZOHO_DATA_CENTERS as readonly string[]).includes(value);
}

interface ZohoDcUrls {
  accounts: string;
  api: string;
}

const DC_URLS: Record<ZohoDataCenter, ZohoDcUrls> = {
  com: { accounts: 'https://accounts.zoho.com', api: 'https://www.zohoapis.com' },
  sa: { accounts: 'https://accounts.zoho.sa', api: 'https://www.zohoapis.sa' },
  eu: { accounts: 'https://accounts.zoho.eu', api: 'https://www.zohoapis.eu' },
  in: { accounts: 'https://accounts.zoho.in', api: 'https://www.zohoapis.in' },
  au: { accounts: 'https://accounts.zoho.com.au', api: 'https://www.zohoapis.com.au' },
  jp: { accounts: 'https://accounts.zoho.jp', api: 'https://www.zohoapis.jp' },
  ca: { accounts: 'https://accounts.zohocloud.ca', api: 'https://www.zohoapis.ca' },
};

export function zohoAccountsBaseUrl(dc: ZohoDataCenter): string {
  return DC_URLS[dc].accounts;
}

export function zohoApiBaseUrl(dc: ZohoDataCenter): string {
  return DC_URLS[dc].api;
}

/**
 * After the OAuth code exchange, Zoho returns a `location` field (e.g. "sa")
 * indicating the DC the user authenticated under. Trust this value over
 * whatever the user originally selected — the user may have picked the wrong
 * region and Zoho will only accept calls on the right DC.
 */
export function normalizeDcFromOAuthResponse(
  raw: string | undefined | null,
  fallback: ZohoDataCenter,
): ZohoDataCenter {
  if (!raw) return fallback;
  const lowered = raw.toLowerCase().trim();
  // Zoho sometimes returns 'au' or 'com.au' for the AU DC — normalise.
  if (lowered === 'com.au') return 'au';
  if (isZohoDataCenter(lowered)) return lowered;
  return fallback;
}
