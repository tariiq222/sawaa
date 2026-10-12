import { ClientPortalController } from './portal.controller';
import type { ClientSession } from '../../common/auth/client-session.decorator';

const session: ClientSession = { id: 'client-1', email: null, phone: null, channel: 'mobile' };
const h = () => ({ execute: jest.fn() });

describe('ClientPortalController', () => {
  const upcoming = h(); const summary = h(); const notifs = h(); const payments = h(); const client = h();
  const c = new ClientPortalController(upcoming as never, summary as never, notifs as never, payments as never, client as never);
  afterEach(() => jest.clearAllMocks());

  it('home aggregates the four reads into plain arrays', async () => {
    upcoming.execute.mockResolvedValue({ data: [{ id: 'b1' }], meta: {} });
    notifs.execute.mockResolvedValue({ items: [{ id: 'n1' }] });
    payments.execute.mockResolvedValue([{ id: 'p1' }]);
    client.execute.mockResolvedValue({ id: 'client-1' });
    const res = await c.home(session);
    expect(res).toEqual({
      profile: { id: 'client-1' },
      upcomingBookings: [{ id: 'b1' }],
      unreadNotifications: [{ id: 'n1' }],
      recentPayments: [{ id: 'p1' }],
    });
    expect(upcoming.execute).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'client-1', page: 1, limit: 5 }));
    expect(notifs.execute).toHaveBeenCalledWith({ recipientId: 'client-1', unreadOnly: true, page: 1, limit: 5 });
    expect(payments.execute).toHaveBeenCalledWith({ clientId: 'client-1', page: 1, limit: 3 });
    expect(client.execute).toHaveBeenCalledWith({ clientId: 'client-1' });
  });
  it('summary reads by session id', async () => {
    summary.execute.mockResolvedValue({ totalBookings: 1 });
    await expect(c.summary(session)).resolves.toEqual({ totalBookings: 1 });
    expect(summary.execute).toHaveBeenCalledWith('client-1');
  });
  it('upcoming maps pageSize to limit', async () => {
    upcoming.execute.mockResolvedValue({ data: [] });
    await c.upcoming(session, { page: 2, pageSize: 4 });
    expect(upcoming.execute).toHaveBeenCalledWith({ clientId: 'client-1', page: 2, limit: 4 });
  });
});
