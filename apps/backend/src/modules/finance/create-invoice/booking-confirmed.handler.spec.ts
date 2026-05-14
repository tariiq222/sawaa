import { BookingConfirmedHandler } from './booking-confirmed.handler';

const buildEventBus = () => {
  let subscriber: ((env: { payload: { bookingId: string; clientId: string; employeeId: string; branchId: string; price: number; currency: string } }) => Promise<void>) | null = null;
  return {
    subscribe: jest.fn((_, cb) => { subscriber = cb as typeof subscriber; }),
    publish: jest.fn(),
    getSubscriber: () => subscriber!,
  };
};

const buildCreateInvoice = () => ({
  execute: jest.fn().mockResolvedValue({ id: 'inv-1' }),
});

const mockBooking = { id: 'book-1', clientId: 'c-1', employeeId: 'e-1', price: 300, currency: 'SAR', serviceId: 'svc-1' };

const makeEnvelope = () => ({
  payload: { bookingId: 'book-1', clientId: 'c-1', employeeId: 'e-1', branchId: 'branch-1', price: 300, currency: 'SAR' },
});

describe('BookingConfirmedHandler', () => {
  it('registers subscriber on bookings.booking.confirmed', () => {
    const eb = buildEventBus();
    const createInvoice = buildCreateInvoice();
    const handler = new BookingConfirmedHandler(eb as never, createInvoice as never);
    handler.register();
    expect(eb.subscribe).toHaveBeenCalledWith('bookings.booking.confirmed', expect.any(Function));
  });

  it('calls createInvoice when booking confirmed', async () => {
    const eb = buildEventBus();
    const createInvoice = buildCreateInvoice();
    const handler = new BookingConfirmedHandler(eb as never, createInvoice as never);
    handler.register();

    await eb.getSubscriber()(makeEnvelope());

    expect(createInvoice.execute).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'book-1' }),
    );
  });

  it('does not throw on 409 ConflictException (idempotent re-delivery)', async () => {
    const eb = buildEventBus();
    const createInvoice = buildCreateInvoice();
    createInvoice.execute = jest.fn().mockRejectedValue({ status: 409 });
    const handler = new BookingConfirmedHandler(eb as never, createInvoice as never);
    handler.register();

    await expect(eb.getSubscriber()(makeEnvelope())).resolves.not.toThrow();
  });
});
