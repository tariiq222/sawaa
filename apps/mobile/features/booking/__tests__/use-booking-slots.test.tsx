import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockBranches = jest.fn().mockResolvedValue([{ id: 'branch-1', isMain: true }]);
const mockDays = jest.fn();
const mockSlots = jest.fn();
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: false }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/branches', () => ({ branchesService: { getAll: (...args: unknown[]) => mockBranches(...args) } }));
jest.mock('@/services/client/branches', () => ({ publicBranchesService: { list: (...args: unknown[]) => mockBranches(...args) } }));
jest.mock('@/services/client/employees', () => ({ publicEmployeesService: {
  getAvailableDays: (...args: unknown[]) => mockDays(...args), getSlots: (...args: unknown[]) => mockSlots(...args),
} }));
jest.mock('@/services/client', () => ({ publicEmployeesService: {
  getAvailableDays: (...args: unknown[]) => mockDays(...args), getSlots: (...args: unknown[]) => mockSlots(...args),
} }));
import { useBookingSlots, toLocalDateOnly } from '../use-booking-slots';
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return ({ children }: React.PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockDays.mockResolvedValue([{ date: toLocalDateOnly(new Date()), hasSlots: true }]);
  mockSlots.mockResolvedValue([{ startTime: '2026-10-07T10:00:00Z', endTime: '2026-10-07T11:00:00Z' }]);
});
afterEach(() => clients.splice(0).forEach((client) => client.clear()));
it('shares branch, available-days and slot reads for the same booking context', async () => {
  const context = { employeeId: 'employee-1', serviceId: 'service-1', durationOptionId: 'duration-1' };
  const { result } = renderHook(() => [useBookingSlots(context), useBookingSlots(context)], { wrapper: setup() });
  await waitFor(() => expect(result.current.every((value) => value.slots.length === 1)).toBe(true));
  expect(mockBranches).toHaveBeenCalledTimes(1);
  expect(mockDays).toHaveBeenCalledTimes(1);
  expect(mockSlots).toHaveBeenCalledTimes(1);
});
it('keeps different branches and duration options in separate availability caches', async () => {
  mockSlots.mockImplementation(({ branchId, durationOptionId }) => Promise.resolve([{ startTime: `${branchId}:${durationOptionId}`, endTime: 'end' }]));
  const { result } = renderHook(() => [
    useBookingSlots({ employeeId: 'employee-1', serviceId: 'service-1', branchId: 'branch-a', durationOptionId: 'short' }),
    useBookingSlots({ employeeId: 'employee-1', serviceId: 'service-1', branchId: 'branch-b', durationOptionId: 'long' }),
  ], { wrapper: setup() });
  await waitFor(() => expect(result.current[0].slots[0]?.startTime).toBe('branch-a:short'));
  expect(result.current[1].slots[0]?.startTime).toBe('branch-b:long');
});
it('stays idle when no priced booking option has been selected', async () => {
  const { result } = renderHook(() => useBookingSlots({ employeeId: 'employee-1', serviceId: 'service-1', enabled: false }), { wrapper: setup() });
  await waitFor(() => expect(result.current.daysLoading).toBe(false));
  expect(mockDays).not.toHaveBeenCalled();
  expect(mockSlots).not.toHaveBeenCalled();
});

it('does not switch the selected appointment to a different slot after availability refresh', async () => {
  const { result } = renderHook(() => useBookingSlots({ employeeId: 'employee-1', serviceId: 'service-1', branchId: 'branch-1' }), { wrapper: setup() });
  await waitFor(() => expect(result.current.slots).toHaveLength(1));
  act(() => result.current.setSlotIdx(0));
  expect(result.current.selectedSlot?.startTime).toBe('2026-10-07T10:00:00Z');
  mockSlots.mockResolvedValue([{ startTime: '2026-10-07T14:00:00Z', endTime: '2026-10-07T15:00:00Z' }]);
  act(() => result.current.handleRetry());
  await waitFor(() => expect(result.current.slots[0].startTime).toBe('2026-10-07T14:00:00Z'));
  expect(result.current.selectedSlot).toBeNull();
});

it('ignores a shared discovery failure when the booking already specifies its branch', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  await expect(client.fetchQuery({ queryKey: ['public-branches', 'list'], queryFn: async () => { throw new Error('Discovery offline'); } })).rejects.toThrow('Discovery offline');
  const wrapper = ({ children }: React.PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useBookingSlots({ employeeId: 'employee-1', serviceId: 'service-1', branchId: 'explicit-branch' }), { wrapper });
  await waitFor(() => expect(result.current.slots).toHaveLength(1));
  expect(result.current.branchId).toBe('explicit-branch');
  expect(result.current.daysError).toBeNull();
  expect(result.current.daysLoading).toBe(false);
  expect(mockBranches).not.toHaveBeenCalled();
  act(() => result.current.handleRetryDays());
  await waitFor(() => expect(mockDays).toHaveBeenCalledTimes(2));
  expect(result.current.daysError).toBeNull();
});

it('waits for a current slot read before excluding a day with a cached empty response', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  const today = toLocalDateOnly(new Date());
  const params = { employeeId: 'employee-1', branchId: 'branch-1', serviceId: 'service-1', startDate: today, days: 30, deliveryType: 'in_person' };
  client.setQueryData(['therapists', 'available-days', params], [{ date: today, hasSlots: true }]);
  client.setQueryData(['therapists', 'slots', { ...params, date: today }], []);
  let finishSlots!: (slots: Array<{ startTime: string; endTime: string }>) => void;
  mockSlots.mockImplementationOnce(() => new Promise((resolve) => { finishSlots = resolve; }));
  const wrapper = ({ children }: React.PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useBookingSlots({ employeeId: 'employee-1', serviceId: 'service-1', branchId: 'branch-1' }), { wrapper });
  await waitFor(() => expect(mockSlots).toHaveBeenCalledTimes(1));
  await act(async () => { finishSlots([{ startTime: 'fresh-slot', endTime: 'fresh-end' }]); });
  await waitFor(() => expect(result.current.slots[0]?.startTime).toBe('fresh-slot'));
  expect(result.current.availabilityByDate?.[today]).toBe(true);
  expect(result.current.dayIdx).toBe(0);
});

it('reopens a previously empty day when a fresh availability overview offers it again', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 60_000 } } });
  clients.push(client);
  const wrapper = ({ children }: React.PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  mockSlots.mockResolvedValueOnce([]);
  const { result } = renderHook(() => useBookingSlots({ employeeId: 'employee-1', serviceId: 'service-1', branchId: 'branch-1' }), { wrapper });
  const today = toLocalDateOnly(new Date());
  await waitFor(() => expect(result.current.availabilityByDate?.[today]).toBe(false));
  expect(result.current.dayIdx).toBeNull();
  mockSlots.mockResolvedValue([{ startTime: 'reopened-slot', endTime: 'reopened-end' }]);
  act(() => result.current.handleRetryDays());
  await waitFor(() => expect(mockDays).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.current.slots[0]?.startTime).toBe('reopened-slot'));
  expect(result.current.availabilityByDate?.[today]).toBe(true);
});
