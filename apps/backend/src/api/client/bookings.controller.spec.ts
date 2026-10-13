import { NotFoundException } from '@nestjs/common';
import { ClientBookingsController } from './bookings.controller';
import { ClientProgramsController } from './programs.controller';
import { ClientPackagesController } from './packages.controller';

const session = { id: 'client-1', email: null, phone: null, channel: 'web' } as never;
const ID = '11111111-1111-4111-8111-111111111111';

function makeBookings() {
  const m = {
    list: { execute: jest.fn() },
    get: { execute: jest.fn() },
    createBooking: { execute: jest.fn() },
    cancellationPreview: { execute: jest.fn() },
    cancelBooking: { execute: jest.fn() },
    reschedule: { execute: jest.fn() },
    bookingAction: { executeForRate: jest.fn(), executeForJoin: jest.fn() },
    rate: { execute: jest.fn() },
    zoom: { execute: jest.fn() },
    bookingInvoice: { execute: jest.fn() },
  };
  const c = new ClientBookingsController(
    m.list as never, m.get as never, m.createBooking as never, m.cancellationPreview as never,
    m.cancelBooking as never, m.reschedule as never, m.bookingAction as never, m.rate as never,
    m.zoom as never, m.bookingInvoice as never,
  );
  return { c, m };
}

describe('ClientBookingsController', () => {
  it.each(['cancel', 'reschedule'] as const)('%s excludes host URLs and staff-only fields from mutation responses', async (action) => {
    const { c, m } = makeBookings();
    const booking = { id: ID, status: 'CONFIRMED', zoomHostUrl: 'host-secret', zoomStartUrl: 'start-secret', notes: 'staff note', zoomMeetingError: 'provider-private' };
    m.cancelBooking.execute.mockResolvedValue({ status: 'CANCEL_REQUESTED', requiresApproval: true, booking });
    m.reschedule.execute.mockResolvedValue({ booking });
    const result = action === 'cancel'
      ? (await c.cancel(session, ID, {} as never)).booking
      : (await c.rescheduleBooking(session, ID, {} as never)).booking;
    expect(result).toMatchObject({ id: ID, status: 'CONFIRMED' });
    for (const field of ['zoomHostUrl', 'zoomStartUrl', 'notes', 'zoomMeetingError']) expect(result).not.toHaveProperty(field);
  });
  it('lists with date tab semantics, upper enums and default pageSize 20', async () => {
    const { c, m } = makeBookings();
    const envelope = { items: [], total: 0, page: 1, pageSize: 20 };
    m.list.execute.mockResolvedValue(envelope);
    await expect(c.listMyBookings(session, { tab: 'upcoming' })).resolves.toBe(envelope);
    expect(m.list.execute).toHaveBeenCalledWith({
      clientId: 'client-1', page: 1, pageSize: 20, tab: 'upcoming', status: undefined,
      tabSemantics: 'date', enumCase: 'upper',
    });
  });

  it('creates through CreatePublicBookingHandler with session client id', async () => {
    const { c, m } = makeBookings();
    m.createBooking.execute.mockResolvedValue({ id: 'b1' });
    await c.create(session, {
      serviceId: 's', employeeId: 'e', scheduledAt: '2026-05-01T09:00:00.000Z', couponCode: 'X', payAtClinic: true,
    } as never);
    expect(m.createBooking.execute).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'client-1', serviceId: 's', employeeId: 'e', branchId: undefined,
      scheduledAt: new Date('2026-05-01T09:00:00.000Z'), couponCode: 'X', payAtClinic: true,
    }));
  });

  it('gets a booking with upper enums and passes 404 through', async () => {
    const { c, m } = makeBookings();
    m.get.execute.mockResolvedValue({ id: ID });
    await c.getBooking(session, ID);
    expect(m.get.execute).toHaveBeenCalledWith(ID, 'client-1', { enumCase: 'upper' });
    m.get.execute.mockRejectedValue(new NotFoundException());
    await expect(c.getBooking(session, ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forwards the cancellation preview', async () => {
    const { c, m } = makeBookings();
    m.cancellationPreview.execute.mockResolvedValue({ ok: true });
    await expect(c.preview(session, ID)).resolves.toEqual({ ok: true });
    expect(m.cancellationPreview.execute).toHaveBeenCalledWith(ID, 'client-1');
  });

  it('cancel maps notes/reason to the handler command and returns the web shape unflattened', async () => {
    const { c, m } = makeBookings();
    const result = { status: 'CANCELLED', booking: { id: ID }, requiresApproval: false };
    m.cancelBooking.execute.mockResolvedValue(result);
    const out = await c.cancel(session, ID, {
      reason: 'CLIENT_REQUESTED', notes: 'plans changed', acceptedRefundTerms: true, quoteToken: 'q', sourceActionId: 'a',
    } as never);
    expect(out).toEqual(result);
    expect(m.cancelBooking.execute).toHaveBeenCalledWith({
      bookingId: ID, clientId: 'client-1', reason: 'plans changed', cancellationReason: 'CLIENT_REQUESTED',
      acceptedRefundTerms: true, quoteToken: 'q', sourceActionId: 'a',
    });
  });

  it('cancel passes 404 through', async () => {
    const { c, m } = makeBookings();
    m.cancelBooking.execute.mockRejectedValue(new NotFoundException());
    await expect(c.cancel(session, ID, { acceptedRefundTerms: true, quoteToken: 'q' } as never))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('reschedules', async () => {
    const { c, m } = makeBookings();
    m.reschedule.execute.mockResolvedValue({ booking: { id: ID } });
    await c.rescheduleBooking(session, ID, { newScheduledAt: '2026-06-01T09:00:00.000Z' } as never);
    expect(m.reschedule.execute).toHaveBeenCalledWith({
      bookingId: ID, clientId: 'client-1', newScheduledAt: '2026-06-01T09:00:00.000Z',
    });
  });

  it('rates using the booking owner/employee from the ownership check', async () => {
    const { c, m } = makeBookings();
    m.bookingAction.executeForRate.mockResolvedValue({ clientId: 'client-1', employeeId: 'emp' });
    m.rate.execute.mockResolvedValue({ id: 'r' });
    await c.rateBooking(session, ID, { score: 5, comment: 'ok', isPublic: true });
    expect(m.bookingAction.executeForRate).toHaveBeenCalledWith(ID, 'client-1');
    expect(m.rate.execute).toHaveBeenCalledWith({
      bookingId: ID, clientId: 'client-1', employeeId: 'emp', score: 5, comment: 'ok', isPublic: true,
    });
  });

  it('rate passes 404 through without submitting', async () => {
    const { c, m } = makeBookings();
    m.bookingAction.executeForRate.mockRejectedValue(new NotFoundException());
    await expect(c.rateBooking(session, ID, { score: 5 })).rejects.toBeInstanceOf(NotFoundException);
    expect(m.rate.execute).not.toHaveBeenCalled();
  });

  it('join returns the existing URL without creating a meeting', async () => {
    const { c, m } = makeBookings();
    const scheduledAt = new Date();
    m.bookingAction.executeForJoin.mockResolvedValue({ zoomJoinUrl: 'https://z/1', scheduledAt });
    await expect(c.join(session, ID)).resolves.toEqual({ joinUrl: 'https://z/1', scheduledAt });
    expect(m.zoom.execute).not.toHaveBeenCalled();
  });

  it('join lazily creates the meeting', async () => {
    const { c, m } = makeBookings();
    const scheduledAt = new Date();
    m.bookingAction.executeForJoin.mockResolvedValue({ zoomJoinUrl: null, scheduledAt });
    m.zoom.execute.mockResolvedValue({ zoomJoinUrl: 'https://z/2', scheduledAt });
    await expect(c.join(session, ID)).resolves.toEqual({ joinUrl: 'https://z/2', scheduledAt });
    expect(m.zoom.execute).toHaveBeenCalledWith({ bookingId: ID });
  });

  it('reads the booking invoice', async () => {
    const { c, m } = makeBookings();
    m.bookingInvoice.execute.mockResolvedValue({ id: 'inv', pdfUrl: 'receipts/inv.pdf' });
    await expect(c.invoice(session, ID)).resolves.toEqual({ id: 'inv', hasReceipt: true });
    expect(m.bookingInvoice.execute).toHaveBeenCalledWith(ID, 'client-1');
  });
});

describe('ClientProgramsController', () => {
  it('enrols as a public program for the session client and passes 404 through', async () => {
    const enroll = { execute: jest.fn().mockResolvedValue({ type: 'ENROLLED' }) };
    const c = new ClientProgramsController(enroll as never);
    await c.enroll(session, ID);
    expect(enroll.execute).toHaveBeenCalledWith({ programId: ID, clientId: 'client-1', public: true });
    enroll.execute.mockRejectedValue(new NotFoundException());
    await expect(c.enroll(session, ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ClientPackagesController', () => {
  it('lists purchases without internal notes', async () => {
    const list = { execute: jest.fn().mockResolvedValue([{ id: 'p', notes: 'secret', status: 'ACTIVE' }]) };
    const c = new ClientPackagesController(list as never, {} as never, {} as never);
    await expect(c.listMyPurchases(session, { status: 'ACTIVE' } as never)).resolves.toEqual([{ id: 'p', status: 'ACTIVE' }]);
    expect(list.execute).toHaveBeenCalledWith({ clientId: 'client-1', status: 'ACTIVE' });
  });

  it('reads one purchase and passes 404 through', async () => {
    const status = { execute: jest.fn().mockRejectedValue(new NotFoundException()) };
    const c = new ClientPackagesController({} as never, status as never, {} as never);
    await expect(c.getMyPurchase(session, ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(status.execute).toHaveBeenCalledWith(ID, 'client-1');
  });

  it('books from credit with the session client and a Date', async () => {
    const book = { execute: jest.fn().mockResolvedValue({ id: 'b' }) };
    const c = new ClientPackagesController({} as never, {} as never, book as never);
    await c.bookCredit(session, { creditId: 'c', scheduledAt: '2026-05-01T09:00:00.000Z' } as never);
    expect(book.execute).toHaveBeenCalledWith({
      creditId: 'c', clientId: 'client-1', scheduledAt: new Date('2026-05-01T09:00:00.000Z'),
    });
  });
});
