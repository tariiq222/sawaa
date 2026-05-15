import { NoOpAdapter } from './no-op.adapter';
import { SmsProviderNotConfiguredError } from './sms-provider.interface';

describe('NoOpAdapter (SMS)', () => {
  let adapter: NoOpAdapter;

  beforeEach(() => {
    adapter = new NoOpAdapter();
  });

  it('should throw on send', async () => {
    await expect(adapter.send('+966501234567', 'Hello', 'Sawaa')).rejects.toThrow(SmsProviderNotConfiguredError);
  });

  it('should throw on verifyDlrSignature', () => {
    expect(() => adapter.verifyDlrSignature({ rawBody: 'test', signature: 'sig' }, 'secret')).toThrow(SmsProviderNotConfiguredError);
  });

  it('should throw on parseDlr', () => {
    expect(() => adapter.parseDlr('{}')).toThrow(SmsProviderNotConfiguredError);
  });
});
