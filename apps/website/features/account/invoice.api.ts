import { getApiBase } from '@/lib/api-base';

export interface InvoiceDetail {
  id: string;
  sellerName?: string | null;
  branchId: string;
  clientId: string;
  employeeId: string;
  bookingId: string;
  subtotal: number;
  discountAmt: number;
  vatRate: number;
  vatAmt: number;
  total: number;
  currency: string;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export async function getMyBookingInvoice(
  bookingId: string,
  cookieHeader: string,
): Promise<InvoiceDetail> {
  const res = await fetch(
    `${getApiBase()}/public/me/bookings/${encodeURIComponent(bookingId)}/invoice`,
    {
      cache: 'no-store',
      headers: { cookie: cookieHeader },
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Failed to fetch invoice');
  }
  const json = await res.json();
  return (json.data ?? json) as InvoiceDetail;
}
