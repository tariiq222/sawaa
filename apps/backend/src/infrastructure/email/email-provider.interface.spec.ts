import { EmailProviderNotConfiguredError } from './email-provider.interface';

describe('EmailProviderNotConfiguredError', () => {
  it('has correct name and message', () => {
    const err = new EmailProviderNotConfiguredError();
    expect(err.name).toBe('EmailProviderNotConfiguredError');
    expect(err.message).toBe('Email provider not configured for this organization');
  });
});
