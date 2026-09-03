import type { CreateContactMessagePayload } from '@sawaa/api-client';

import { PublicFetchError, publicFetch } from '@/lib/public-fetch';

export async function submitContactMessage(payload: CreateContactMessagePayload): Promise<void> {
  try {
    await publicFetch<void>('/public/contact-messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (!(error instanceof PublicFetchError)) throw error;

    // Do NOT surface the raw backend body to the UI — it leaks English error
    // text / JSON into the Arabic form. Keep only the status for logging; the
    // form renders a fixed plain-Arabic message via the i18n layer.
    throw new Error(`Contact submission failed: ${error.status}`);
  }
}
