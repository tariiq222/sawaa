import { NoOpEmailAdapter } from './no-op.adapter';

describe('NoOpEmailAdapter', () => {
  let adapter: NoOpEmailAdapter;

  beforeEach(() => {
    adapter = new NoOpEmailAdapter();
  });

  it('should report not available', () => {
    expect(adapter.isAvailable()).toBe(false);
  });

  it('should return noop message id', async () => {
    const result = await adapter.sendMail({ to: 'test@example.com', subject: 'Test', body: 'Hello' } as any);
    expect(result.messageId).toBe('noop');
  });
});
