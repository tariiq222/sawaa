import { NotFoundException } from '@nestjs/common';
import { ClientNotificationsController } from './notifications.controller';
import type { ClientSession } from '../../common/auth/client-session.decorator';

const session: ClientSession = { id: 'client-1', email: null, phone: null, channel: 'web' };
const h = () => ({ execute: jest.fn() });

describe('ClientNotificationsController', () => {
  const list = h(); const markRead = h(); const unread = h(); const reg = h(); const unreg = h();
  const c = new ClientNotificationsController(list as never, markRead as never, unread as never, reg as never, unreg as never);
  afterEach(() => jest.clearAllMocks());

  it('lists with page/pageSize mapped to the handler limit', async () => {
    list.execute.mockResolvedValue({ items: [] });
    await c.list(session, { unreadOnly: true, page: 2, pageSize: 5 });
    expect(list.execute).toHaveBeenCalledWith({ recipientId: 'client-1', unreadOnly: true, page: 2, limit: 5 });
  });
  it('applies defaults when the query is empty', async () => {
    await c.list(session, {});
    expect(list.execute).toHaveBeenCalledWith({ recipientId: 'client-1', unreadOnly: undefined, page: 1, limit: 20 });
  });
  it('returns the unread count', async () => {
    unread.execute.mockResolvedValue({ count: 3 });
    await expect(c.unreadCount(session)).resolves.toEqual({ count: 3 });
    expect(unread.execute).toHaveBeenCalledWith({ recipientId: 'client-1' });
  });
  it('marks one notification read and passes a 404 through', async () => {
    await c.markReadEndpoint(session, { notificationId: 'n1' });
    expect(markRead.execute).toHaveBeenCalledWith({ recipientId: 'client-1', notificationId: 'n1' });
    markRead.execute.mockRejectedValue(new NotFoundException());
    await expect(c.markReadEndpoint(session, { notificationId: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });
  it('registers and unregisters FCM tokens', async () => {
    reg.execute.mockResolvedValue({ ok: true });
    await expect(c.registerFcmToken(session, { token: 't' } as never)).resolves.toEqual({ ok: true });
    expect(reg.execute).toHaveBeenCalledWith({ clientId: 'client-1', token: 't' });
    await c.unregisterFcmToken(session, { token: 't' });
    expect(unreg.execute).toHaveBeenCalledWith({ clientId: 'client-1', token: 't' });
    await c.unregisterFcmToken(session, {});
    expect(unreg.execute).toHaveBeenLastCalledWith({ clientId: 'client-1' });
  });
});
