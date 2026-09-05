import { runNotificationOutboxRetry } from './notification-outbox-retry-cli';

describe('runNotificationOutboxRetry', () => {
  it('passes the explicit delivery, actor, and reason to the scoped handler', async () => {
    const handler = { execute: jest.fn().mockResolvedValue(undefined) };

    await runNotificationOutboxRetry(
      [
        '--delivery-id',
        '11111111-1111-4111-8111-111111111111',
        '--actor',
        'ops@example.test',
        '--reason',
        'provider configuration repaired',
      ],
      handler,
    );

    expect(handler.execute).toHaveBeenCalledWith({
      deliveryId: '11111111-1111-4111-8111-111111111111',
      actor: 'ops@example.test',
      reason: 'provider configuration repaired',
    });
  });

  it.each(['--delivery-id', '--actor', '--reason'])(
    'rejects a missing %s without touching the database handler',
    async (missing) => {
      const values: Record<string, string> = {
        '--delivery-id': '11111111-1111-4111-8111-111111111111',
        '--actor': 'ops@example.test',
        '--reason': 'provider configuration repaired',
      };
      delete values[missing];
      const args = Object.entries(values).flat();
      const handler = { execute: jest.fn().mockResolvedValue(undefined) };

      await expect(runNotificationOutboxRetry(args, handler)).rejects.toThrow(missing);
      expect(handler.execute).not.toHaveBeenCalled();
    },
  );
});
