import { renderHook, waitFor } from '@testing-library/react-native';

const mockGetInvoice = jest.fn();
jest.mock('@/services/client/payments', () => ({
  clientPaymentsService: {
    getInvoice: (...args: unknown[]) => mockGetInvoice(...args),
  },
}));

import { usePaymentStatus } from '../use-payment-status';

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
});
