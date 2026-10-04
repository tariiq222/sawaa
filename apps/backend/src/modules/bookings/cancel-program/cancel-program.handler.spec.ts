import { CancelProgramHandler } from './cancel-program.handler';
import { stableEventId } from '../../../common/events';
const row = (id: string, status = 'CONFIRMED', extra = {}) => ({ id, status, clientId: `c-${id}`, employeeId: 'e1', scheduledAt: new Date('2030-01-01'), bookingNumber: 1, currency: 'SAR', checkedInAt: null, isHistoricalImport: false, client: { firstName: 'A', lastName: 'B' }, ...extra });
function setup(rows = [row('b1')]) {
  const program = { id: 'g1', nameAr: 'Group', status: 'OPEN', startDate: null };
  const events = new Map();
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    program: { findUnique: jest.fn(async () => program), update: jest.fn(async ({ data }) => Object.assign(program, data)) },
    programEnrollment: { findMany: jest.fn(async () => rows.map(booking => ({ bookingId: booking.id, booking }))) },
    client: { findMany: jest.fn(async () => rows.map(b => ({ id: b.clientId, name: 'Participant' }))) },
    payment: { findMany: jest.fn().mockResolvedValue([]) },
    booking: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    bookingStatusLog: { create: jest.fn() },
    outboxEvent: { findUnique: jest.fn(async ({ where }) => events.get(where.id) ?? null), create: jest.fn(async ({ data }) => { events.set(data.id, data); return data; }) },
  };
  const handler = new CancelProgramHandler(tx as never, { withTransaction: async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx) } as never);
  return { handler, tx, program, events };
}
describe('program cancellation durable financial policy', () => {
  it('reports a missing program without mutation', async () => {
    const { handler, tx } = setup();
    tx.program.findUnique.mockResolvedValue(null as never);
    await expect(handler.preview('absent')).rejects.toMatchObject({ status: 404 });
    expect(tx.program.update).not.toHaveBeenCalled();
  });
  it('excludes historical participant funds and state from all cancellation effects', async () => {
    const { handler, tx } = setup([row('b1', 'CONFIRMED', { isHistoricalImport: true })]);
    tx.payment.findMany.mockResolvedValue([{ id: 'p1', invoiceId: 'i1', status: 'COMPLETED', amount: 10000, refundedAmount: 0, currency: 'SAR', method: 'CASH', gatewayRef: null, refundRequests: [] }] as never);
    const quote = await handler.preview('g1');
    expect(quote.participants[0].maxRefundAmount).toBe(0);
    const result = await handler.execute('g1', { reason: 'Closed', quoteToken: quote.quoteToken, refunds: [{ bookingId: 'b1', amount: 0 }] }, 'staff1');
    expect(result).toMatchObject({ cancelledEnrollments: 0, skippedEnrollments: 1, participants: [] });
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create.mock.calls.map(([call]) => call.data.eventType)).toEqual(['bookings.program.cancelled']);
  });
  it.each(['DRAFT', 'OPEN', 'MIN_REACHED', 'SCHEDULED'])('cancels %s without participants and durably stores zero counts', async status => {
    const { handler, program } = setup([]);
    program.status = status;
    const quote = await handler.preview('g1');
    expect(await handler.execute('g1', { reason: 'Closed', quoteToken: quote.quoteToken }, 'staff1')).toMatchObject({ status: 'CANCELLED', cancelledEnrollments: 0, skippedEnrollments: 0 });
  });
  it('quotes first, cancels active rows, preserves terminal history and reports actual counts', async () => {
    const { handler, tx } = setup([row('b1'), row('b2', 'COMPLETED'), row('b3', 'CONFIRMED', { isHistoricalImport: true })]);
    const quote = await handler.preview('g1');
    const result = await handler.execute('g1', { reason: 'Closed', quoteToken: quote.quoteToken }, 'staff1');
    expect(result).toMatchObject({ cancelledEnrollments: 1, skippedEnrollments: 2 });
    expect(tx.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.bookingStatusLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ changedBy: 'staff1' }) }));
    const event = tx.outboxEvent.create.mock.calls.map(([call]) => call.data).find(e => e.id === stableEventId('booking:b1:program-cancel:g1'));
    expect(event.payload.payload.centerCancellation).toMatchObject({ initiatedBy: 'CENTER', performedBy: 'staff1', reason: expect.stringContaining('Group') });
  });
  it('requires fresh explicit confirmation after money or mode changes, without mutation', async () => {
    const { handler, tx, program } = setup();
    const quote = await handler.preview('g1');
    program.startDate = new Date('2020-01-01') as never;
    await expect(handler.execute('g1', { reason: 'Closed', quoteToken: quote.quoteToken }, 'staff1')).rejects.toMatchObject({ status: 409 });
    expect(tx.program.update).not.toHaveBeenCalled();
  });
  it('replays its durable frozen result without additional refunds or status logs', async () => {
    const { handler, tx } = setup();
    const quote = await handler.preview('g1');
    const command = { reason: 'Closed', quoteToken: quote.quoteToken };
    const first = await handler.execute('g1', command, 'staff1');
    const second = await handler.execute('g1', command, 'staff1');
    expect(second).toEqual(first);
    expect(tx.bookingStatusLog.create).toHaveBeenCalledTimes(1);
  });
  it.each([{ code: 'P2010', meta: { code: '55P03' } }, { code: 'P2010', meta: { driverAdapterError: { cause: { originalCode: '55P03' } } } }])('converts lock contention to retryable conflict without changing any status: %p', async error => {
    const { handler, tx } = setup();
    tx.$queryRaw.mockRejectedValue(error);
    await expect(handler.execute('g1', { reason: 'Closed', quoteToken: 'old' }, 'staff1')).rejects.toMatchObject({ status: 409 });
    expect(tx.program.update).not.toHaveBeenCalled();
  });
  it('rejects concurrent status changes instead of overwriting history', async () => {
    const { handler, tx } = setup();
    const quote = await handler.preview('g1');
    tx.booking.updateMany.mockResolvedValue({ count: 0 });
    await expect(handler.execute('g1', { reason: 'Closed', quoteToken: quote.quoteToken }, 'staff1')).rejects.toMatchObject({ status: 409 });
  });
});
