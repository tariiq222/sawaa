import { renderHook, waitFor } from '@testing-library/react-native';

const mockGetInvoice = jest.fn();
jest.mock('@/services/client/payments', () => ({
  clientPaymentsService: {
    getInvoice: (...args: unknown[]) => mockGetInvoice(...args),
  },
}));

import { usePaymentStatus, resolveConfirmedPhase } from '@/features/booking/use-payment-status';

describe('usePaymentStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports confirmed when there is no invoice (pay-at-clinic)', async () => {
    const { result } = renderHook(() => usePaymentStatus(undefined));
    await waitFor(() => expect(result.current.phase).toBe('confirmed'));
    expect(mockGetInvoice).not.toHaveBeenCalled();
  });

  it('reports confirmed when the invoice is PAID', async () => {
    mockGetInvoice.mockResolvedValue({
      id: 'inv-1',
      status: 'PAID',
      payments: [{ id: 'p1', status: 'COMPLETED' }],
    });
    const { result } = renderHook(() => usePaymentStatus('inv-1', 'success'));
    await waitFor(() => expect(result.current.phase).toBe('confirmed'));
  });

  // Regression for P1-21: a cancelled/failed payment must NOT report success.
  it('reports failed when a payment FAILED', async () => {
    mockGetInvoice.mockResolvedValue({
      id: 'inv-1',
      status: 'PENDING',
      payments: [{ id: 'p1', status: 'FAILED' }],
    });
    const { result } = renderHook(() => usePaymentStatus('inv-1', 'success'));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
  });

  it('reports failed when the invoice is CANCELLED', async () => {
    mockGetInvoice.mockResolvedValue({ id: 'inv-1', status: 'CANCELLED', payments: [] });
    const { result } = renderHook(() => usePaymentStatus('inv-1', 'success'));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
  });

  // Regression for P1-21: the user dismissed the gateway browser and nothing
  // was charged — this must resolve to failed, never confirmed.
  it('reports failed when the user dismissed the gateway and no payment exists', async () => {
    mockGetInvoice.mockResolvedValue({ id: 'inv-1', status: 'PENDING', payments: [] });
    const { result } = renderHook(() => usePaymentStatus('inv-1', 'dismiss'));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
  });

  it('reports pending when a payment is still PENDING_VERIFICATION', async () => {
    mockGetInvoice.mockResolvedValue({
      id: 'inv-1',
      status: 'PENDING',
      payments: [{ id: 'p1', status: 'PENDING_VERIFICATION' }],
    });
    const { result } = renderHook(() => usePaymentStatus('inv-1', 'success'));
    await waitFor(() => expect(result.current.phase).toBe('pending'));
  });

  // Regression: a historical FAILED payment must not override a fresh PENDING retry.
  it('reports pending when a new PENDING attempt exists alongside an older FAILED one', async () => {
    mockGetInvoice.mockResolvedValue({
      id: 'inv-1',
      status: 'PENDING',
      payments: [
        { id: 'p2', status: 'PENDING' },
        { id: 'p1', status: 'FAILED' },
      ],
    });
    const { result } = renderHook(() => usePaymentStatus('inv-1', 'success'));
    await waitFor(() => expect(result.current.phase).toBe('pending'));
  });
});

describe('resolveConfirmedPhase', () => {
  it('keeps the payment phase for every non-confirmed payment state', () => {
    for (const phase of ['polling', 'pending', 'failed'] as const) {
      expect(resolveConfirmedPhase(phase, true, true, 'PENDING')).toBe(phase);
    }
  });

  it('downgrades a paid invoice to pending while the booking is not confirmed', () => {
    expect(resolveConfirmedPhase('confirmed', true, true, 'PENDING')).toBe('pending');
    expect(resolveConfirmedPhase('confirmed', true, true, 'CANCELLED')).toBe('pending');
    expect(resolveConfirmedPhase('confirmed', true, true, '')).toBe('pending');
  });

  it('confirms once the booking itself is confirmed', () => {
    expect(resolveConfirmedPhase('confirmed', true, true, 'CONFIRMED')).toBe('confirmed');
    expect(resolveConfirmedPhase('confirmed', true, true, 'completed')).toBe('confirmed');
  });

  it('does not require a booking when there is no invoice (pay-at-clinic)', () => {
    expect(resolveConfirmedPhase('confirmed', false, false, undefined)).toBe('confirmed');
  });

  it('never claims confirmation when an invoiced booking could not be read', () => {
    expect(resolveConfirmedPhase('confirmed', true, false, undefined)).toBe('pending');
  });

  it('requires a booking id for an invoiced confirmation', () => {
    expect(resolveConfirmedPhase('confirmed', true, false, 'CONFIRMED')).toBe('pending');
  });
});
