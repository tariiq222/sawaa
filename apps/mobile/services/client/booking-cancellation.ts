import api from '../api';
import type { CancellationPreview, CancellationQuoteInput } from '../../../../packages/api-client/src/types/cancellation';

/** Mobile bearer transport; preserve the established cancellation reason/notes. */
export async function getClientCancellationPreview(id: string): Promise<CancellationPreview> {
  const response = await api.get<CancellationPreview>(`/mobile/client/bookings/${encodeURIComponent(id)}/cancellation-preview`);
  return response.data;
}

export async function cancelClientBooking(id: string, cancelNotes?: string, quote?: CancellationQuoteInput): Promise<unknown> {
  const response = await api.patch<unknown>(`/mobile/client/bookings/${encodeURIComponent(id)}/cancel`, {
    reason: 'CLIENT_REQUESTED',
    ...quote,
    ...(cancelNotes ? { cancelNotes } : {}),
  });
  return response.data;
}
