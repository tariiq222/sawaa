import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearPendingBookingCheckout,
  clearClosedBookingCheckout,
  getPendingBookingCheckout,
  isPendingBookingResumable,
  resolvePendingBookingResume,
  savePendingBookingCheckout,
  type BookingPaymentDraft,
} from '@/features/booking/payment-resume-state';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));
jest.mock('@/services/client/bookings', () => ({ clientBookingsService: { getById: jest.fn() } }));

const storage = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
};
const { clientBookingsService } = jest.requireMock('@/services/client/bookings') as { clientBookingsService: { getById: jest.Mock } };

const draft: BookingPaymentDraft = {
  branchId: 'branch-1',
  employeeId: 'employee-1',
  serviceId: 'service-1',
  scheduledAt: '2026-10-01T10:00:00.000Z',
  durationOptionId: 'duration-1',
  deliveryType: 'online',
};

const booking = {
  id: 'booking-1',
  invoiceId: 'invoice-1',
  status: 'pending' as const,
  branchId: '',
  employeeId: 'employee-1',
  serviceId: 'service-1',
  scheduledAt: '2026-10-01T13:00:00+03:00',
  deliveryType: 'online' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('payment resume state', () => {
  it('keeps one booking across an init rejection and re-entry', async () => {
    const values = new Map<string, string>();
    storage.getItem.mockImplementation(async (key: string) => values.get(key) ?? null);
    storage.setItem.mockImplementation(async (key: string, value: string) => { values.set(key, value); });
    let createCount = 0;
    const createOnce = async () => {
      createCount += 1;
      return { bookingId: 'booking-1', invoiceId: 'invoice-1' };
    };
    const first = await createOnce();
    await savePendingBookingCheckout('client-1', draft, first);
    await expect(Promise.reject(new Error('init unavailable'))).rejects.toThrow('init unavailable');
    const resumed = await getPendingBookingCheckout('client-1', draft);
    const second = resumed.kind === 'found' ? resumed.checkout : await createOnce();
    expect(second).toMatchObject(first);
    expect(createCount).toBe(1);
  });

  it('round-trips one pending booking per authenticated user and exact draft', async () => {
    const values = new Map<string, string>();
    storage.getItem.mockImplementation(async (key: string) => values.get(key) ?? null);
    storage.setItem.mockImplementation(async (key: string, value: string) => {
      values.set(key, value);
    });

    await savePendingBookingCheckout('client-1', draft, { bookingId: 'booking-1', invoiceId: 'invoice-1' });
    await expect(getPendingBookingCheckout('client-1', draft)).resolves.toEqual({
      kind: 'found',
      checkout: { bookingId: 'booking-1', invoiceId: 'invoice-1', draft },
    });
    await expect(getPendingBookingCheckout('client-1', { ...draft, scheduledAt: '2026-10-01T11:00:00.000Z' }))
      .resolves.toEqual({ kind: 'missing' });
    const otherDraft = { ...draft, scheduledAt: '2026-10-01T11:00:00.000Z' };
    await savePendingBookingCheckout('client-1', otherDraft, { bookingId: 'booking-2', invoiceId: 'invoice-2' });
    await expect(getPendingBookingCheckout('client-1', draft)).resolves.toMatchObject({
      kind: 'found', checkout: { bookingId: 'booking-1', invoiceId: 'invoice-1' },
    });
    await expect(getPendingBookingCheckout('client-1', otherDraft)).resolves.toMatchObject({
      kind: 'found', checkout: { bookingId: 'booking-2', invoiceId: 'invoice-2' },
    });
  });

  it('does not resume a record belonging to another booking or invoice', async () => {
    storage.getItem.mockResolvedValue(JSON.stringify({
      version: 1,
      userId: 'client-1',
      draft,
      bookingId: 'booking-1',
      invoiceId: 'invoice-1',
    }));

    await expect(getPendingBookingCheckout('client-1', draft, { bookingId: 'other-booking', invoiceId: 'invoice-1' }))
      .resolves.toEqual({ kind: 'missing' });
    await expect(getPendingBookingCheckout('client-1', draft, { bookingId: 'booking-1', invoiceId: 'other-invoice' }))
      .resolves.toEqual({ kind: 'missing' });
  });

  it('fails closed for malformed persisted state and uncertain booking status', async () => {
    storage.getItem.mockResolvedValue('{not-json');
    await expect(getPendingBookingCheckout('client-1', draft)).resolves.toEqual({ kind: 'invalid' });

    expect(isPendingBookingResumable(booking, { bookingId: 'booking-1', invoiceId: 'invoice-1' })).toBe(true);
    expect(isPendingBookingResumable({ ...booking, employeeId: 'other-employee' }, { bookingId: 'booking-1', invoiceId: 'invoice-1' }, draft)).toBe(false);
    expect(isPendingBookingResumable({ ...booking, invoiceId: null }, { bookingId: 'booking-1', invoiceId: 'invoice-1' })).toBe(false);
    expect(isPendingBookingResumable({ ...booking, status: 'confirmed' }, { bookingId: 'booking-1', invoiceId: 'invoice-1' })).toBe(false);
    expect(isPendingBookingResumable({ ...booking, invoiceId: null, status: 'confirmed' }, { bookingId: 'booking-1', invoiceId: null })).toBe(false);
  });

  it('uses authenticated GET to resume a route identity when storage is unavailable', async () => {
    storage.getItem.mockResolvedValue(null);
    clientBookingsService.getById.mockResolvedValue(booking);
    await expect(resolvePendingBookingResume('client-1', draft, {
      bookingId: 'booking-1', invoiceId: 'invoice-1',
    })).resolves.toMatchObject({ kind: 'ready', checkout: { bookingId: 'booking-1', invoiceId: 'invoice-1' } });
    expect(clientBookingsService.getById).toHaveBeenCalledWith('booking-1');
  });

  it('validates an explicitly bound invoice with the server even when the local record is corrupt', async () => {
    storage.getItem.mockResolvedValue('{not-json');
    clientBookingsService.getById.mockResolvedValue(booking);
    await expect(resolvePendingBookingResume('client-1', draft, { bookingId: 'booking-1', invoiceId: 'invoice-1' }))
      .resolves.toMatchObject({ kind: 'ready', checkout: { bookingId: 'booking-1', invoiceId: 'invoice-1' } });
    clientBookingsService.getById.mockResolvedValue({ ...booking, invoiceId: 'different-invoice' });
    await expect(resolvePendingBookingResume('client-1', draft, { bookingId: 'booking-1', invoiceId: 'invoice-1' }))
      .resolves.toEqual({ kind: 'invalid' });
  });

  it('resumes the same deposit booking invoice for balance collection instead of marking payment complete', async () => {
    storage.getItem.mockResolvedValue(null);
    clientBookingsService.getById.mockResolvedValue({ ...booking, status: 'deposit_paid' });
    await expect(resolvePendingBookingResume('client-1', draft, { bookingId: 'booking-1', invoiceId: 'invoice-1' }))
      .resolves.toMatchObject({ kind: 'ready', checkout: { bookingId: 'booking-1', invoiceId: 'invoice-1' } });
  });

  it('recognizes an invoice-less deposit booking without inventing a payment', async () => {
    storage.getItem.mockResolvedValue(null);
    clientBookingsService.getById.mockResolvedValue({ ...booking, status: 'deposit_paid', invoiceId: null });
    await expect(resolvePendingBookingResume('client-1', draft, { bookingId: 'booking-1', invoiceId: null }))
      .resolves.toMatchObject({ kind: 'complete', checkout: { bookingId: 'booking-1', invoiceId: null } });
  });

  it.each(['cancelled', 'expired'] as const)('retires a server-verified %s draft so the exact slot can start again', async (status) => {
    const values = new Map<string, string>();
    storage.getItem.mockImplementation(async (key: string) => values.get(key) ?? null);
    storage.setItem.mockImplementation(async (key: string, value: string) => { values.set(key, value); });
    storage.removeItem.mockImplementation(async (key: string) => { values.delete(key); });
    await savePendingBookingCheckout('client-1', draft, { bookingId: 'booking-1', invoiceId: 'invoice-1' });
    clientBookingsService.getById.mockResolvedValue({ ...booking, status });
    await expect(resolvePendingBookingResume('client-1', draft)).resolves.toEqual({ kind: 'missing' });
    await expect(getPendingBookingCheckout('client-1', draft)).resolves.toEqual({ kind: 'missing' });
    await expect(resolvePendingBookingResume('client-1', draft, { bookingId: 'booking-1', invoiceId: 'invoice-1' }))
      .resolves.toEqual({ kind: 'invalid', unavailableReason: status === 'expired' ? 'BOOKING_EXPIRED' : 'BOOKING_CLOSED' });
  });

  it('retains an uncertain stored identity when authoritative verification fails', async () => {
    const values = new Map<string, string>();
    storage.getItem.mockImplementation(async (key: string) => values.get(key) ?? null);
    storage.setItem.mockImplementation(async (key: string, value: string) => { values.set(key, value); });
    await savePendingBookingCheckout('client-1', draft, { bookingId: 'booking-1', invoiceId: 'invoice-1' });
    clientBookingsService.getById.mockRejectedValueOnce(new Error('offline'));
    await expect(resolvePendingBookingResume('client-1', draft)).rejects.toThrow('offline');
    await expect(getPendingBookingCheckout('client-1', draft)).resolves.toMatchObject({ kind: 'found', checkout: { bookingId: 'booking-1' } });
  });

  it.each(['no_show', 'unknown'] as const)('retains a %s draft instead of treating it as a fresh reservation', async (status) => {
    const values = new Map<string, string>();
    storage.getItem.mockImplementation(async (key: string) => values.get(key) ?? null);
    storage.setItem.mockImplementation(async (key: string, value: string) => { values.set(key, value); });
    await savePendingBookingCheckout('client-1', draft, { bookingId: 'booking-1', invoiceId: 'invoice-1' });
    clientBookingsService.getById.mockResolvedValue({ ...booking, status });
    await expect(resolvePendingBookingResume('client-1', draft)).resolves.toMatchObject({ kind: 'invalid' });
    await expect(getPendingBookingCheckout('client-1', draft)).resolves.toMatchObject({ kind: 'found', checkout: { bookingId: 'booking-1' } });
  });

  it('retains a cancelled record whose invoice no longer matches the authoritative identity', async () => {
    const values = new Map<string, string>();
    storage.getItem.mockImplementation(async (key: string) => values.get(key) ?? null);
    storage.setItem.mockImplementation(async (key: string, value: string) => { values.set(key, value); });
    await savePendingBookingCheckout('client-1', draft, { bookingId: 'booking-1', invoiceId: 'invoice-1' });
    clientBookingsService.getById.mockResolvedValue({ ...booking, status: 'cancelled', invoiceId: 'different-invoice' });
    await expect(resolvePendingBookingResume('client-1', draft)).resolves.toMatchObject({ kind: 'invalid' });
    await expect(getPendingBookingCheckout('client-1', draft)).resolves.toMatchObject({ kind: 'found', checkout: { invoiceId: 'invoice-1' } });
  });

  it('verifies a newer identity saved while the cancelled booking GET was in flight', async () => {
    const values = new Map<string, string>();
    storage.getItem.mockImplementation(async (key: string) => values.get(key) ?? null);
    storage.setItem.mockImplementation(async (key: string, value: string) => { values.set(key, value); });
    storage.removeItem.mockImplementation(async (key: string) => { values.delete(key); });
    await savePendingBookingCheckout('client-1', draft, { bookingId: 'booking-1', invoiceId: 'invoice-1' });
    let respond!: (value: unknown) => void;
    let startRead!: () => void;
    const reading = new Promise<void>((resolve) => { startRead = resolve; });
    clientBookingsService.getById.mockImplementationOnce(() => { startRead(); return new Promise((resolve) => { respond = resolve; }); });
    clientBookingsService.getById.mockResolvedValueOnce({ ...booking, id: 'booking-2', invoiceId: 'invoice-2' });
    const resume = resolvePendingBookingResume('client-1', draft);
    await reading;
    await savePendingBookingCheckout('client-1', draft, { bookingId: 'booking-2', invoiceId: 'invoice-2' });
    respond({ ...booking, status: 'cancelled' });
    await expect(resume).resolves.toMatchObject({ kind: 'ready', checkout: { bookingId: 'booking-2', invoiceId: 'invoice-2' } });
  });

  it('preserves a newer same-slot checkout when cancellation cleanup overlaps its save', async () => {
    const values = new Map<string, string>();
    storage.getItem.mockImplementation(async (key: string) => values.get(key) ?? null);
    storage.setItem.mockImplementation(async (key: string, value: string) => { values.set(key, value); });
    await savePendingBookingCheckout('client-1', draft, { bookingId: 'booking-1', invoiceId: 'invoice-1' });
    let beginRemoval!: () => void;
    const removalStarted = new Promise<void>((resolve) => { beginRemoval = resolve; });
    let finishRemoval!: () => void;
    const removalGate = new Promise<void>((resolve) => { finishRemoval = resolve; });
    storage.removeItem.mockImplementation(async (key: string) => {
      beginRemoval();
      await removalGate;
      values.delete(key);
    });
    const cleanup = clearClosedBookingCheckout('client-1', 'booking-1');
    await removalStarted;
    const save = savePendingBookingCheckout('client-1', draft, { bookingId: 'booking-2', invoiceId: 'invoice-2' });
    // Let the racing write reach storage if mutations are not ordered.
    await new Promise<void>((resolve) => setImmediate(resolve));
    finishRemoval();
    await Promise.all([cleanup, save]);
    await expect(getPendingBookingCheckout('client-1', draft)).resolves.toMatchObject({
      kind: 'found', checkout: { bookingId: 'booking-2', invoiceId: 'invoice-2' },
    });
  });

  it('clears a completed checkout record for the authenticated user', async () => {
    await clearPendingBookingCheckout('client-1');
    expect(storage.removeItem).toHaveBeenCalledWith(expect.stringContaining('client-1'));
  });
});
