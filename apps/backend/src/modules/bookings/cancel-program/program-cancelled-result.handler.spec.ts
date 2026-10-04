import { ProgramCancelledResultHandler } from './program-cancelled-result.handler';
it('registers the stable program result acknowledgement consumer so durable summaries can publish', async () => {
  const bus = { subscribe: jest.fn() };
  const handler = new ProgramCancelledResultHandler(bus as never);
  handler.onModuleInit();
  expect(bus.subscribe).toHaveBeenCalledWith('bookings.program.cancelled', 'bookings.program-cancelled-result.v1', expect.any(Function));
  await expect(bus.subscribe.mock.calls[0][2]({ version: 1, payload: { id: 'g1', status: 'CANCELLED' } })).resolves.toBeUndefined();
  await expect(bus.subscribe.mock.calls[0][2]({ version: 2, payload: { id: 'g1', status: 'CANCELLED' } })).rejects.toThrow();
});
