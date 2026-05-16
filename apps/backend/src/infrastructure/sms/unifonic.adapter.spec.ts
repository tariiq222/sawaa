import { UnifonicAdapter } from './unifonic.adapter';
import * as fetchModule from '../http/fetch-with-timeout';

describe('UnifonicAdapter', () => {
  let adapter: UnifonicAdapter;

  beforeEach(() => {
    adapter = new UnifonicAdapter({ appSid: 'app-sid-123', apiKey: 'api-key-456' });
  });

  it('send constructs payload with AppSid, Recipient, Body', async () => {
    const fetchSpy = jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { MessageID: 'msg-1' } }),
    } as any);

    await adapter.send('+966501234567', 'Hello world', null);

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options!.body as string);
    expect(body).toMatchObject({
      AppSid: 'app-sid-123',
      Recipient: '+966501234567',
      Body: 'Hello world',
    });
    expect(body.SenderID).toBeUndefined();
  });

  it('send adds SenderID when provided', async () => {
    const fetchSpy = jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { MessageID: 'msg-1' } }),
    } as any);

    await adapter.send('+966501234567', 'Hello world', 'Sawaa');

    const lastCall = fetchSpy.mock.calls.at(-1)!;
    const [, options] = lastCall;
    const body = JSON.parse(options!.body as string);
    expect(body.SenderID).toBe('Sawaa');
  });

  it('send returns providerMessageId on success', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { MessageID: 'msg-123' } }),
    } as any);

    const result = await adapter.send('+966501234567', 'Hello', null);

    expect(result.providerMessageId).toBe('msg-123');
    expect(result.status).toBe('SENT');
  });

  it('send throws on HTTP error', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as any);

    await expect(adapter.send('+966501234567', 'Hello', null)).rejects.toThrow('Unifonic HTTP 500');
  });

  it('send throws on JSON parse failure (malformed response)', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => { throw new Error('Unexpected token'); },
    } as any);

    await expect(adapter.send('+966501234567', 'Hello', null)).rejects.toThrow();
  });

  it('send throws when success=false', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, errorCode: 'E001', message: 'Failed' }),
    } as any);

    await expect(adapter.send('+966501234567', 'Hello', null)).rejects.toThrow('Unifonic error');
  });

  it('send throws when MessageID missing', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: {} }),
    } as any);

    await expect(adapter.send('+966501234567', 'Hello', null)).rejects.toThrow('Unifonic error');
  });

  it('verifyDlrSignature succeeds with valid signature', () => {
    const { createHmac } = require('crypto');
    const rawBody = JSON.stringify({ status: 'delivered', messageId: '123' });
    const secret = 'webhook-secret';
    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');

    expect(() => adapter.verifyDlrSignature({ rawBody, signature } as any, secret)).not.toThrow();
  });

  it('verifyDlrSignature throws on malformed signature (non-hex)', () => {
    expect(() =>
      adapter.verifyDlrSignature({ rawBody: 'test', signature: 'not-hex!!!' } as any, 'secret'),
    ).toThrow('Unifonic DLR signature mismatch');
  });

  it('verifyDlrSignature throws on mismatch', () => {
    const { createHmac } = require('crypto');
    const signature = createHmac('sha256', 'wrong-secret').update('test').digest('hex');

    expect(() => adapter.verifyDlrSignature({ rawBody: 'test', signature } as any, 'secret')).toThrow(
      'Unifonic DLR signature mismatch',
    );
  });

  it('verifyDlrSignature throws on length mismatch', () => {
    expect(() =>
      adapter.verifyDlrSignature({ rawBody: 'test', signature: 'aa' } as any, 'secret'),
    ).toThrow('Unifonic DLR signature mismatch');
  });

  it('parseDlr returns DELIVERED for delivered status', () => {
    const result = adapter.parseDlr(JSON.stringify({ messageId: '123', status: 'delivered' }));

    expect(result.status).toBe('DELIVERED');
    expect(result.providerMessageId).toBe('123');
  });

  it('parseDlr returns FAILED for other statuses', () => {
    const result = adapter.parseDlr(JSON.stringify({ messageId: '123', status: 'failed' }));

    expect(result.status).toBe('FAILED');
  });

  it('parseDlr throws when messageId missing', () => {
    expect(() => adapter.parseDlr(JSON.stringify({ status: 'delivered' }))).toThrow(
      'Unifonic DLR missing messageId',
    );
  });

  it('parseDlr includes errorCode and errorMessage', () => {
    const result = adapter.parseDlr(
      JSON.stringify({ messageId: '123', status: 'failed', errorCode: 'E001', errorMessage: 'Rejected' }),
    );

    expect(result.errorCode).toBe('E001');
    expect(result.errorMessage).toBe('Rejected');
  });
});
