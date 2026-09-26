import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { queryClient } from '@/services/query-client';

const mockGetMobileHomeCards = jest.fn();
jest.mock('@/services/mobile-home-cards', () => ({ getMobileHomeCards: () => mockGetMobileHomeCards() }));

import { mobileHomeCardsQueryKey, useMobileHomeCards } from '../useMobileHomeCards';
import type { PublicMobileHomeCard } from '@/services/mobile-home-cards';

const cards: PublicMobileHomeCard[] = [{
  id: 'cached-card', titleAr: 'عنوان', titleEn: null, descriptionAr: null, descriptionEn: null,
  imageUrl: null, imageAltAr: null, imageAltEn: null, destination: null,
}];

describe('shared query error handling for mobile home cards', () => {
  beforeEach(() => {
    queryClient.clear();
    queryClient.setQueryDefaults(mobileHomeCardsQueryKey, { retry: false });
    mockGetMobileHomeCards.mockReset();
  });
  afterEach(() => {
    queryClient.clear();
    jest.restoreAllMocks();
  });

it('retains cached cards and suppresses the global alert when their refresh fails', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  queryClient.setQueryData(mobileHomeCardsQueryKey, cards);
  mockGetMobileHomeCards.mockRejectedValue(new Error('Not Found'));
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useMobileHomeCards(), { wrapper });

  let refreshResult: Awaited<ReturnType<typeof result.current.refetch>> | undefined;
  await act(async () => { refreshResult = await result.current.refetch(); });

  expect(refreshResult?.error?.message).toBe('Not Found');
  expect(queryClient.getQueryData(mobileHomeCardsQueryKey)).toEqual(cards);
  expect(alert).not.toHaveBeenCalled();
  unmount();
});

it('continues to alert for ordinary query failures', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await expect(queryClient.fetchQuery({
    queryKey: ['ordinary-query'],
    queryFn: async () => { throw new Error('ordinary failure'); },
    retry: false,
  })).rejects.toThrow('ordinary failure');
  await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.any(String), 'ordinary failure'));
});
});
