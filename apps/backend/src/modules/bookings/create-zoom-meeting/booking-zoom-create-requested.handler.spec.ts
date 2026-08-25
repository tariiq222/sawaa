import { BookingZoomCreateRequestedHandler } from './booking-zoom-create-requested.handler';

describe('BookingZoomCreateRequestedHandler', () => {
  it('uses a stable consumer id and rethrows transient failures for BullMQ retry', async () => {
    const eventBus = { subscribe: jest.fn() };
    let consume: ((event: { payload: { bookingId: string } }) => Promise<void>) | undefined;
    eventBus.subscribe.mockImplementation((_name, _id, handler) => { consume = handler; });
    const create = { execute: jest.fn().mockRejectedValue(new Error('provider unavailable')) };
    const handler = new BookingZoomCreateRequestedHandler(eventBus as never, create as never);
    handler.register();
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'bookings.zoom.create_requested',
      'bookings.zoom-create.v1',
      expect.any(Function),
    );
    await expect(consume!({ payload: { bookingId: 'booking-1' } })).rejects.toThrow('provider unavailable');
  });
});
