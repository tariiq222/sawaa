import api from '../api';
import type { CancellationPreview, CancellationQuoteInput } from '../../../../packages/api-client/src/types/cancellation';

/** Unified client API transport; `notes` carries the free-text cancellation note. */
export async function getClientCancellationPreview(id: string): Promise<CancellationPreview> {
  const response = await api.get<CancellationPreview>(`/client/bookings/${encodeURIComponent(id)}/cancellation-preview`);
  return response.data;
}

export async function cancelClientBooking(id: string, cancelNotes?: string, quote?: CancellationQuoteInput): Promise<unknown> {
  const response = await api.patch<unknown>(`/client/bookings/${encodeURIComponent(id)}/cancel`, {
    reason: 'CLIENT_REQUESTED',
    ...quote,
    ...(cancelNotes ? { notes: cancelNotes } : {}),
  });
  return response.data;
}
