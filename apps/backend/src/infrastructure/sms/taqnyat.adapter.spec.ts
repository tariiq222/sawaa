import { TaqnyatAdapter } from './taqnyat.adapter';
import * as fetchModule from '../http/fetch-with-timeout';

describe('TaqnyatAdapter', () => {
  let adapter: TaqnyatAdapter;

  beforeEach(() => {
    adapter = new TaqnyatAdapter({ apiToken: 'test-token' });
  });

  it('should send SMS', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => ({ statusCode: 200, messageId: 'msg-1' }),
    } as any);
    const result = await adapter.send('+966501234567', 'Hello', 'Sawaa');
    expect(result.providerMessageId).toBe('msg-1');
  });

  it('should send SMS without sender', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => ({ statusCode: 200, messageId: 'msg-1' }),
    } as any);
    const result = await adapter.send('+966501234567', 'Hello', null);
    expect(result.providerMessageId).toBe('msg-1');
  });

  it('should throw on HTTP error', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    } as any);
    await expect(adapter.send('+966501234567', 'Hello', 'Sawaa')).rejects.toThrow('Taqnyat HTTP');
  });

  it('should throw on API error', async () => {
    jest.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => ({ statusCode: 400, message: 'Error' }),
    } as any);
    await expect(adapter.send('+966501234567', 'Hello', 'Sawaa')).rejects.toThrow('Taqnyat error');
  });

  it('should verify DLR signature', () => {
    const rawBody = JSON.stringify({ status: 'delivered', messageId: '123' });
    const secret = 'webhook-secret';
    const { createHmac } = require('crypto');
    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
    expect(() => adapter.verifyDlrSignature({ rawBody, signature }, secret)).not.toThrow();
  });

  it('should throw on signature mismatch', () => {
    const { createHmac } = require('crypto');
    const signature = createHmac('sha256', 'wrong-secret').update('test').digest('hex');
    expect(() => adapter.verifyDlrSignature({ rawBody: 'test', signature }, 'secret')).toThrow('mismatch');
  });

  it('should throw on empty signature', () => {
    expect(() => adapter.verifyDlrSignature({ rawBody: 'test', signature: '' }, 'secret')).toThrow('mismatch');
  });

  it('should parse DLR as delivered', () => {
    const result = adapter.parseDlr(JSON.stringify({ messageId: '123', status: 'delivered' }));
    expect(result.status).toBe('DELIVERED');
  });

  it('should parse DLR as failed', () => {
    const result = adapter.parseDlr(JSON.stringify({ messageId: '123', status: 'failed' }));
    expect(result.status).toBe('FAILED');
  });

  it('should throw on missing messageId', () => {
    expect(() => adapter.parseDlr(JSON.stringify({ status: 'delivered' }))).toThrow('missing messageId');
  });
});
