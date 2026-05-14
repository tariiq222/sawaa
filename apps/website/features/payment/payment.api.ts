import { getApiBase } from '@/lib/api-base';

export async function initGuestPayment(
  bookingId: string,
  sessionToken: string,
): Promise<{ paymentId: string; redirectUrl: string }> {
  const res = await fetch(`${getApiBase()}/public/payments/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ bookingId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Payment init failed');
  }
  const json = await res.json();
  return (json.data ?? json) as { paymentId: string; redirectUrl: string };
}

export async function getPublicBranding(): Promise<unknown> {
  const res = await fetch(`${getApiBase()}/public/branding`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Failed to fetch branding: ${res.status}`);
  return res.json();
}
