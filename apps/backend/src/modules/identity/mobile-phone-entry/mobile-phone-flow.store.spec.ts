import * as bcrypt from 'bcryptjs';
import { MobilePhoneFlowStore, codeHash, newCode, newContinuation, hashContinuation } from './mobile-phone-flow.store';

describe('MobilePhoneFlowStore', () => {
  const model = { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() };
  const tx = { $queryRaw: jest.fn(), mobilePhoneEntryFlow: model };
  const transactions = { withTransaction: jest.fn() };
  const store = new MobilePhoneFlowStore({} as never, transactions as never);
  const flow = (extra = {}) => ({ id: 'id', state: 'CODE_PENDING', codeHash: null, codeExpiresAt: new Date(Date.now() + 60000), attempts: 0, createdAt: new Date(), consumedAt: null, ...extra });
  beforeEach(() => jest.resetAllMocks());

  it('uses CSPRNG six-digit codes, bcrypt, and 32-byte SHA256-only continuations', async () => {
    const code = newCode();
    expect(code).toMatch(/^\d{6}$/);
    const hash = await codeHash(code);
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    expect(await bcrypt.compare(code, hash)).toBe(true);
    const token = newContinuation();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(hashContinuation(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashContinuation(token)).not.toBe(token);
  });
  it('delegates transactions with the bounded timeout', async () => {
    const run = jest.fn();
    transactions.withTransaction.mockResolvedValue('result');
    expect(await store.transaction(run)).toBe('result');
    expect(transactions.withTransaction).toHaveBeenCalledWith(run, { timeout: 15000 });
  });
  it('locks the row before reading it', async () => {
    model.findUnique.mockResolvedValue(flow());
    await store.lock(tx as never, 'id');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(model.findUnique.mock.invocationCallOrder[0]);
    expect(model.findUnique).toHaveBeenCalledWith({ where: { id: 'id' } });
  });
  it.each([{ state: 'FAILED' }, { state: 'CONSUMED' }, { consumedAt: new Date() }, { createdAt: new Date(Date.now() - 900000) }])('rejects terminal or hard-expired flow %j', (extra) => {
    expect(store.liveFlow(flow(extra) as never)).toBe(false);
  });
  it('accepts a live flow', () => expect(store.liveFlow(flow() as never)).toBe(true));
  it.each(['FAILED', 'CONSUMED', 'DETAILS_PENDING'])('rejects code in %s', async (state) => {
    expect(await store.checkCode(tx as never, flow({ state }) as never, '123456')).toBe(false);
    expect(model.update).not.toHaveBeenCalled();
  });
  it.each([{ attempts: 5 }, { codeExpiresAt: new Date(0) }, { createdAt: new Date(Date.now() - 900000) }, { consumedAt: new Date() }])('rejects unusable correct proof %j', async (extra) => {
    expect(await store.checkCode(tx as never, flow({ codeHash: await bcrypt.hash('123456', 4), ...extra }) as never, '123456')).toBe(false);
    expect(model.update).not.toHaveBeenCalled();
  });
  it('commits the fifth wrong attempt using a false sentinel, never an exception', async () => {
    expect(await store.checkCode(tx as never, flow({ codeHash: await bcrypt.hash('123456', 4), attempts: 4 }) as never, '999999')).toBe(false);
    expect(model.update).toHaveBeenCalledWith({ where: { id: 'id' }, data: { attempts: { increment: 1 } } });
  });
  it('accepts correct code without spending an attempt', async () => {
    expect(await store.checkCode(tx as never, flow({ codeHash: await bcrypt.hash('123456', 4) }) as never, '123456')).toBe(true);
    expect(model.update).not.toHaveBeenCalled();
  });
  it('rejects a rotated continuation after locking its candidate', async () => {
    model.findUnique.mockResolvedValueOnce(flow({ continuationHash: hashContinuation('old') })).mockResolvedValueOnce(flow({ continuationHash: hashContinuation('new') }));
    expect(await store.lockContinuation(tx as never, 'old')).toBeNull();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });
  it.each([{ state: 'CODE_PENDING' }, { continuationExpiresAt: new Date(0) }, { createdAt: new Date(Date.now() - 900000) }])('rejects invalid continuation %j', async (extra) => {
    const row = flow({ state: 'DETAILS_PENDING', continuationHash: hashContinuation('token'), continuationExpiresAt: new Date(Date.now() + 60000), ...extra });
    model.findUnique.mockResolvedValue(row);
    expect(await store.lockContinuation(tx as never, 'token')).toBeNull();
  });
  it('returns only a live locked continuation using its digest lookup', async () => {
    const row = flow({ state: 'DETAILS_PENDING', continuationHash: hashContinuation('token'), continuationExpiresAt: new Date(Date.now() + 60000) });
    model.findUnique.mockResolvedValue(row);
    expect(await store.lockContinuation(tx as never, 'token')).toBe(row);
    expect(model.findUnique.mock.calls[0][0]).toEqual({ where: { continuationHash: hashContinuation('token') } });
  });
  it('rejects unknown continuation without locking', async () => {
    model.findUnique.mockResolvedValue(null);
    expect(await store.lockContinuation(tx as never, 'unknown')).toBeNull();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
  it('consumes only once with expected-state compare and clears proofs', async () => {
    model.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await store.consume(tx as never, flow() as never)).toBe(true);
    expect(await store.consume(tx as never, flow() as never)).toBe(false);
    expect(model.updateMany.mock.calls[0][0]).toEqual({ where: { id: 'id', state: 'CODE_PENDING', consumedAt: null }, data: { state: 'CONSUMED', consumedAt: expect.any(Date), codeHash: null, continuationHash: null } });
  });
  it('cannot consume a hard-expired flow', async () => {
    expect(await store.consume(tx as never, flow({ createdAt: new Date(Date.now() - 900000) }) as never)).toBe(false);
    expect(model.updateMany).not.toHaveBeenCalled();
  });
});
