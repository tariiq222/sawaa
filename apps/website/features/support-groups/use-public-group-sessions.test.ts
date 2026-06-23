import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { SupportGroup } from './support-groups.api';

const { getPublicGroupSessionsMock } = vi.hoisted(() => ({
  getPublicGroupSessionsMock: vi.fn(),
}));

vi.mock('./support-groups.api', () => ({
  getPublicGroupSessions: getPublicGroupSessionsMock,
}));

import { usePublicGroupSessions } from './use-public-group-sessions';

const sampleGroup: SupportGroup = {
  id: 'prog-1',
  ref: 1,
  title: 'برنامج تواصل',
  nameAr: 'برنامج تواصل',
  nameEn: 'Communication Program',
  descriptionAr: null,
  descriptionEn: null,
  publicDescriptionAr: null,
  publicDescriptionEn: null,
  departmentId: 'd-1',
  branchId: 'b-1',
  startDate: '2026-05-01T18:00:00Z',
  daysCount: 4,
  hoursPerDay: 2,
  minParticipants: 4,
  maxParticipants: 10,
  enrolledCount: 3,
  price: '50000',
  currency: 'SAR',
  depositEnabled: false,
  depositAmount: null,
  status: 'OPEN',
  isPublic: true,
  isFull: false,
  spotsLeft: 7,
  scheduledAt: '2026-05-01T18:00:00Z',
  durationMins: 120,
  maxCapacity: 10,
  serviceId: '',
  employeeId: '',
};

function withQueryClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper(props: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, props.children);
  };
}

describe('usePublicGroupSessions', () => {
  beforeEach(() => {
    getPublicGroupSessionsMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts in the loading state with an empty sessions list', async () => {
    getPublicGroupSessionsMock.mockResolvedValue([sampleGroup]);
    const { result } = renderHook(() => usePublicGroupSessions(), {
      wrapper: withQueryClient(),
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.sessions).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('returns the resolved sessions and clears loading once the query resolves', async () => {
    getPublicGroupSessionsMock.mockResolvedValue([sampleGroup]);
    const { result } = renderHook(() => usePublicGroupSessions(), {
      wrapper: withQueryClient(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sessions).toEqual([sampleGroup]);
    expect(result.current.error).toBeNull();
  });

  it('forwards departmentId to getPublicGroupSessions in the queryFn', async () => {
    getPublicGroupSessionsMock.mockResolvedValue([sampleGroup]);
    renderHook(() => usePublicGroupSessions('d-7'), {
      wrapper: withQueryClient(),
    });
    await waitFor(() =>
      expect(getPublicGroupSessionsMock).toHaveBeenCalledWith('d-7'),
    );
  });

  it('forwards `undefined` when no departmentId is provided', async () => {
    getPublicGroupSessionsMock.mockResolvedValue([sampleGroup]);
    renderHook(() => usePublicGroupSessions(), {
      wrapper: withQueryClient(),
    });
    await waitFor(() =>
      expect(getPublicGroupSessionsMock).toHaveBeenCalledWith(undefined),
    );
  });

  it('serialises a thrown error into the `error` string', async () => {
    getPublicGroupSessionsMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => usePublicGroupSessions(), {
      wrapper: withQueryClient(),
    });
    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.sessions).toEqual([]);
  });

  it('keeps `error` as null when the query resolves cleanly', async () => {
    getPublicGroupSessionsMock.mockResolvedValue([sampleGroup]);
    const { result } = renderHook(() => usePublicGroupSessions(), {
      wrapper: withQueryClient(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });
});
