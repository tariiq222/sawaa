import type { CreateContactMessagePayload } from '@sawaa/api-client';

import { getApiBase } from '@/lib/api-base';

export async function submitContactMessage(payload: CreateContactMessagePayload): Promise<void> {
  const res = await fetch(`${getApiBase()}/public/contact-messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // Do NOT surface the raw backend body to the UI — it leaks English error
    // text / JSON into the Arabic form. Keep only the status for logging; the
    // form renders a fixed plain-Arabic message via the i18n layer.
    throw new Error(`Contact submission failed: ${res.status}`);
  }
}
