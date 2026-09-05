import { main } from './notification-outbox-retry-cli';

void main().catch((error: unknown) => {
  const name = error instanceof Error ? error.name : 'UnknownError';
  process.stderr.write(`Notification delivery retry failed (${name}).\n`);
  process.exitCode = 1;
});
