import { ClientCancellationZoomHandler } from './client-cancellation-zoom.handler';

describe('client cancellation Zoom cleanup', () => {
  function setup() {
    let booking = { status: 'CANCELLED', zoomMeetingId: 'z1' as string | null };
    const prisma = { booking: { findUnique: jest.fn(async () => booking), updateMany: jest.fn(async () => { booking = { ...booking, zoomMeetingId: null }; return { count: 1 }; }) } };
    const zoom = { deleteMeetingStrict: jest.fn() };
    const handler = new ClientCancellationZoomHandler(prisma as never, {} as never, zoom as never);
    const event = { version: 1, payload: { bookingId: 'b1', organizationId: 'org', zoomMeetingId: 'z1', clientCancellation: { version: 1 } } } as any;
    return { handler, event, zoom, prisma };
  }
  it('deletes only after explicit cancellation and ignores duplicate deliveries', async () => {
    const { handler, event, zoom } = setup();
    await handler.handle(event); await handler.handle(event);
    expect(zoom.deleteMeetingStrict).toHaveBeenCalledTimes(1);
  });
  it('does not expand staff/legacy cancellation behavior', async () => {
    const { handler, event, zoom } = setup();
    delete event.payload.clientCancellation;
    await handler.handle(event);
    expect(zoom.deleteMeetingStrict).not.toHaveBeenCalled();
  });
  it('preserves legacy mobile cleanup without requiring a new financial intent', async () => {
    const { handler, event, zoom } = setup();
    delete event.payload.clientCancellation;
    event.payload.legacyClientCancellation = true;
    await handler.handle(event);
    expect(zoom.deleteMeetingStrict).toHaveBeenCalledWith('org', 'z1');
  });
  it('retains the identifier for retry when provider deletion fails', async () => {
    const { handler, event, zoom, prisma } = setup();
    zoom.deleteMeetingStrict.mockRejectedValueOnce(new Error('unavailable'));
    await expect(handler.handle(event)).rejects.toThrow('unavailable');
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    await handler.handle(event);
    expect(prisma.booking.updateMany).toHaveBeenCalledTimes(1);
  });
});
