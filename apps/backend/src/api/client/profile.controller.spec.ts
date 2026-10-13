import { NotFoundException } from '@nestjs/common';
import { ClientEmailController, ClientPhoneController, ClientProfileController } from './profile.controller';
import type { ClientSession } from '../../common/auth/client-session.decorator';

const session: ClientSession = { id: 'client-1', email: null, phone: null, channel: 'mobile' };
const h = () => ({ execute: jest.fn() });

describe('ClientProfileController', () => {
  const getMe = h(); const update = h(); const del = h();
  const c = new ClientProfileController(getMe as never, update as never, del as never);
  afterEach(() => jest.clearAllMocks());

  it('GET reads the profile by session id', async () => {
    getMe.execute.mockResolvedValue({ id: 'client-1' });
    await expect(c.getProfile(session)).resolves.toEqual({ id: 'client-1' });
    expect(getMe.execute).toHaveBeenCalledWith('client-1');
  });
  it('GET passes a 404 through', async () => {
    getMe.execute.mockRejectedValue(new NotFoundException());
    await expect(c.getProfile(session)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('PATCH updates with the session id and body', async () => {
    update.execute.mockResolvedValue({ id: 'client-1', name: 'A' });
    await expect(c.updateProfile(session, { name: 'A' } as never)).resolves.toEqual({ id: 'client-1', name: 'A' });
    expect(update.execute).toHaveBeenCalledWith('client-1', { name: 'A' });
  });
  it('DELETE returns the closure payload', async () => {
    const payload = { status: 'closed', retained: ['clinical_records', 'financial_records'] };
    del.execute.mockResolvedValue(payload);
    await expect(c.deleteProfile(session)).resolves.toEqual(payload);
    expect(del.execute).toHaveBeenCalledWith({ clientId: 'client-1' });
  });
});

describe('ClientEmailController', () => {
  const status = h(); const request = h(); const verify = h(); const decline = h();
  const c = new ClientEmailController(status as never, request as never, verify as never, decline as never);
  afterEach(() => jest.clearAllMocks());

  it('routes each action to its handler with the session id', async () => {
    status.execute.mockResolvedValue('s'); request.execute.mockResolvedValue('r');
    verify.execute.mockResolvedValue('v'); decline.execute.mockResolvedValue('d');
    await expect(c.status(session)).resolves.toBe('s');
    await expect(c.request(session, { email: 'a@b.co' } as never)).resolves.toBe('r');
    await expect(c.verify(session, { code: '123456' } as never)).resolves.toBe('v');
    await expect(c.decline(session)).resolves.toBe('d');
    expect(status.execute).toHaveBeenCalledWith('client-1');
    expect(request.execute).toHaveBeenCalledWith('client-1', { email: 'a@b.co' });
    expect(verify.execute).toHaveBeenCalledWith('client-1', { code: '123456' });
    expect(decline.execute).toHaveBeenCalledWith('client-1');
  });
});

describe('ClientPhoneController', () => {
  const request = h(); const verify = h();
  const c = new ClientPhoneController(request as never, verify as never);
  afterEach(() => jest.clearAllMocks());

  it('rotates HTTP-only web cookies without returning bearer credentials in JSON', async () => {
    const pair = { accessToken: 'new-access', rawRefresh: 'new-refresh', accessMaxAgeMs: 900000, refreshMaxAgeMs: 604800000 };
    verify.execute.mockResolvedValue({ phone: '+966512345678', tokens: { accessToken: pair.accessToken, refreshToken: pair.rawRefresh }, tokenPair: pair });
    const response = { cookie: jest.fn() };
    const result = await c.verify({ ...session, channel: 'web' }, { code: '012345' } as never, response as never);
    expect(result).toEqual({ phone: '+966512345678' });
    expect(verify.execute).toHaveBeenCalledWith('client-1', { code: '012345' }, 'web');
    expect(response.cookie).toHaveBeenCalledWith('client_access_token', 'new-access', expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 900000 }));
    expect(response.cookie).toHaveBeenCalledWith('client_refresh_token', 'new-refresh', expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 604800000 }));
  });

  it('routes request and verify to their handlers', async () => {
    request.execute.mockResolvedValue('r'); verify.execute.mockResolvedValue({ phone: '+966512345678', tokens: { accessToken: 'a', refreshToken: 'r' } });
    await expect(c.request(session, { phone: '0500000000' } as never)).resolves.toBe('r');
    await expect(c.verify(session, { code: '123456' } as never)).resolves.toEqual({ phone: '+966512345678', tokens: { accessToken: 'a', refreshToken: 'r' } });
    expect(request.execute).toHaveBeenCalledWith('client-1', { phone: '0500000000' });
    expect(verify.execute).toHaveBeenCalledWith('client-1', { code: '123456' }, 'mobile');
  });
});
