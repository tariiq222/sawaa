import { PrismaService } from '../infrastructure/database';
import {
  RetryDeadNotificationDeliveryHandler,
  type RetryDeadNotificationDeliveryCommand,
} from '../modules/comms/notification-outbox/retry-dead-notification-delivery.handler';

type RetryHandler = {
  execute(command: RetryDeadNotificationDeliveryCommand): Promise<void>;
};

function readRequired(args: string[], name: string): string {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1]?.trim() : undefined;
  if (!value || value.startsWith('--')) throw new Error(`${name} is required`);
  return value;
}

export async function runNotificationOutboxRetry(
  args: string[],
  handler: RetryHandler,
): Promise<void> {
  const deliveryId = readRequired(args, '--delivery-id');
  const actor = readRequired(args, '--actor');
  const reason = readRequired(args, '--reason');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deliveryId)) {
    throw new Error('--delivery-id must be a UUID');
  }
  await handler.execute({ deliveryId, actor, reason });
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    await runNotificationOutboxRetry(
      args,
      new RetryDeadNotificationDeliveryHandler(prisma),
    );
    process.stdout.write('Notification delivery requeued.\n');
  } finally {
    await prisma.$disconnect();
  }
}
