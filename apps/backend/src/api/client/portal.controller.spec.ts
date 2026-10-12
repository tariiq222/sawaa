import { ClientPortalController } from './portal.controller';
import type { ClientSession } from '../../common/auth/client-session.decorator';

const session: ClientSession = { id: 'client-1', email: null, phone: null, channel: 'mobile' };
const h = () => ({ execute: jest.fn() });

describe('ClientPortalController', () => {
  const upcoming = h(); const summary = h(); const notifs = h(); const payments = h(); const client = h();
  const c = new ClientPortalController(upcoming as never, summary as never, notifs as never, payments as never, client as never);
  afterEach(() => jest.clearAllMocks());

  it('home aggregates the four reads, projecting payments and using the client profile DTO', async () => {
    upcoming.execute.mockResolvedValue({ data: [{ id: 'b1' }], meta: {} });
    notifs.execute.mockResolvedValue({ items: [{ id: 'n1' }] });
    payments.execute.mockResolvedValue({
      items: [{
        id: 'p1', number: 1, invoiceId: 'i1', amount: 100, currency: 'SAR', method: 'CARD', status: 'COMPLETED',
        createdAt: 'c', processedAt: null, collectionDate: null,
        gatewayRef: 'secret', receiptUrl: 'k/receipt.pdf', notes: 'staff note',
        invoice: { bookingId: 'b1', total: 100, client: { name: 'PII' }, notes: 'x' },
      }],
    });
    const profile = { id: 'client-1', name: 'Client' };
    client.execute.mockResolvedValue(profile);
    const res = await c.home(session);
    expect(res.profile).toBe(profile);
    expect(res.upcomingBookings).toEqual([{ id: 'b1' }]);
    expect(res.unreadNotifications).toEqual([{ id: 'n1' }]);
    expect(res.recentPayments).toEqual([{
      id: 'p1', number: 1, invoiceId: 'i1', amount: 100, currency: 'SAR', method: 'CARD', status: 'COMPLETED',
      createdAt: 'c', processedAt: null, collectionDate: null, invoice: { bookingId: 'b1', total: 100 },
    }]);
    const json = JSON.stringify(res.recentPayments);
    for (const leaked of ['gatewayRef', 'receiptUrl', 'client', 'notes']) expect(json).not.toContain(leaked);
    expect(upcoming.execute).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'client-1', page: 1, limit: 5 }));
    expect(notifs.execute).toHaveBeenCalledWith({ recipientId: 'client-1', unreadOnly: true, page: 1, limit: 5 });
    expect(payments.execute).toHaveBeenCalledWith({ clientId: 'client-1', page: 1, limit: 3 });
    expect(client.execute).toHaveBeenCalledWith('client-1');
  });
  it('summary reads by session id', async () => {
    summary.execute.mockResolvedValue({ totalBookings: 1 });
    await expect(c.summary(session)).resolves.toEqual({ totalBookings: 1 });
    expect(summary.execute).toHaveBeenCalledWith('client-1');
  });
  it('upcoming maps pageSize to limit and answers the canonical page envelope', async () => {
    upcoming.execute.mockResolvedValue({ data: [{ id: 'b1' }], meta: { total: 9, page: 2, limit: 4, totalPages: 3 } });
    const res = await c.upcoming(session, { page: 2, pageSize: 4 });
    expect(upcoming.execute).toHaveBeenCalledWith({ clientId: 'client-1', page: 2, limit: 4 });
    expect(res).toEqual({ items: [{ id: 'b1' }], total: 9, page: 2, pageSize: 4 });
  });
});
