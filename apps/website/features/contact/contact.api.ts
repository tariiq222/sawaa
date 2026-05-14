import type { CreateContactMessagePayload } from '@deqah/api-client';

import { getApiBase } from '@/lib/api-base';

export async function submitContactMessage(payload: CreateContactMessagePayload): Promise<void> {
  const res = await fetch(`${getApiBase()}/public/contact-messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Submission failed: ${res.status}`);
  }
}
