import * as bcrypt from 'bcryptjs';
import { MobileEmailFlowStore } from './mobile-email-flow.store';

describe('MobileEmailFlowStore', () => {
  const tx = { mobileEmailFlow: { update: jest.fn(), updateMany: jest.fn() } };
  const store = new MobileEmailFlowStore({} as never, {} as never);
  beforeEach(() => jest.clearAllMocks());
  it.each(['EMAIL_SENDING', 'FAILED', 'CONSUMED'])('rejects %s without comparing a usable proof', async (state) => {
    const flow = { id: 'id', state, emailCodeHash: await bcrypt.hash('123456', 4), emailExpiresAt: new Date(Date.now() + 10000), emailAttempts: 0 };
    expect(await store.checkCode(tx as never, flow as never, 'email', '123456')).toBe(false);
    expect(tx.mobileEmailFlow.update).not.toHaveBeenCalled();
  });
  it('rejects expired proof even with a correct code', async () => {
    expect(await store.checkCode(tx as never, { state: 'EMAIL_PENDING', emailCodeHash: await bcrypt.hash('123456', 4), emailExpiresAt: new Date(0), emailAttempts: 0 } as never, 'email', '123456')).toBe(false);
  });
  it('persists an incorrect attempt instead of throwing inside the transaction', async () => {
    const flow = { id: 'id', state: 'EMAIL_PENDING', emailCodeHash: await bcrypt.hash('123456', 4), emailExpiresAt: new Date(Date.now() + 10000), emailAttempts: 4 };
    expect(await store.checkCode(tx as never, flow as never, 'email', '999999')).toBe(false);
    expect(tx.mobileEmailFlow.update).toHaveBeenCalledWith({ where: { id: 'id' }, data: { emailAttempts: { increment: 1 } } });
  });
  it('consumes once with an expected-state compare', async () => {
    tx.mobileEmailFlow.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await store.consume(tx as never, { id: 'id', state: 'PHONE_PENDING' } as never)).toBe(true);
    expect(await store.consume(tx as never, { id: 'id', state: 'PHONE_PENDING' } as never)).toBe(false);
    expect(tx.mobileEmailFlow.updateMany.mock.calls[0][0].where).toEqual({ id: 'id', state: 'PHONE_PENDING', consumedAt: null });
  });
  it('cannot settle an old phone generation over a newer generation', async () => {
    const prisma = { mobileEmailFlow: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const subject = new MobileEmailFlowStore(prisma as never, {} as never);
    expect(await subject.settlePhone('id', 'old-id', false)).toBe(false);
    expect(prisma.mobileEmailFlow.updateMany.mock.calls[0][0].where).toEqual({ id: 'id', state: 'PHONE_SENDING', phoneChallengeId: 'old-id' });
  });
});
