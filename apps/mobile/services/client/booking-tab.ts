import type { BookingStatus } from '@/types/booking-enums';
import type { BookingsListResponse } from './bookings';

export type BookingTab = 'upcoming' | 'past' | 'cancelled';

export interface BookingListParams {
  tab?: BookingTab;
  status?: string | string[];
  page?: number;
  limit?: number;
}

export function bookingTabForStatus(status: BookingStatus): BookingTab {
  const normalized = status.toLowerCase();
  if (normalized === 'cancelled' || normalized === 'cancel_requested' || normalized === 'expired') return 'cancelled';
  if (normalized === 'completed' || normalized === 'no_show') return 'past';
  return 'upcoming';
}

export function rejectsUnknownTab(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { message?: unknown } } })?.response;
  if (response?.status !== 400) return false;
  const messages = Array.isArray(response.data?.message) ? response.data.message : [response.data?.message];
  return messages.some((message) => typeof message === 'string' && /property tab should not exist/i.test(message));
}

export async function listLegacyTab(
  params: BookingListParams,
  tab: BookingTab,
  fetchPage: (params: BookingListParams) => Promise<BookingsListResponse>,
): Promise<BookingsListResponse> {
  const requestedPage = params.page ?? 1;
  const requestedLimit = params.limit ?? 20;
  const fetchLimit = Math.max(100, requestedLimit);
  const allItems: BookingsListResponse['items'] = [];
  let nextPage = 1;
  let hasNextPage = true;

  // Older deployed servers reject `tab`. Read their real paginated rows,
  // classify them by the same status contract, then paginate the selected tab.
  while (hasNextPage) {
    const page = await fetchPage({
      ...params,
      tab: undefined,
      page: nextPage,
      limit: fetchLimit,
    });
    allItems.push(...page.items);
    hasNextPage = page.meta.hasNextPage;
    nextPage += 1;
  }

  const matching = allItems.filter((item) => bookingTabForStatus(item.status) === tab);
  const totalPages = Math.max(1, Math.ceil(matching.length / requestedLimit));
  return {
    items: matching.slice((requestedPage - 1) * requestedLimit, requestedPage * requestedLimit),
    meta: {
      total: matching.length,
      page: requestedPage,
      perPage: requestedLimit,
      totalPages,
      hasNextPage: requestedPage < totalPages,
      hasPreviousPage: requestedPage > 1,
    },
  };
}
