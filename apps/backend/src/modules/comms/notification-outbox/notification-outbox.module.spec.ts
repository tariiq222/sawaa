import { MODULE_METADATA } from '@nestjs/common/constants';

import { CommsModule } from '../comms.module';
import { OpsModule } from '../../ops/ops.module';
import { PeopleModule } from '../../people/people.module';
import { CaptureNotificationIntentHandler } from './capture-notification-intent.handler';
import { MaterializeNotificationIntentHandler } from './materialize-notification-intent.handler';
import { NotificationOutboxConfig } from './notification-outbox.config';
import { NotificationOutboxLifecycle } from './notification-outbox.lifecycle';
import { NotificationOutboxModule } from './notification-outbox.module';
import { ResolveNotificationIntentOwnershipHandler } from './resolve-notification-intent-ownership.handler';

function metadata(target: unknown, key: string): unknown[] {
  return Reflect.getMetadata(key, target as object) ?? [];
}

describe('NotificationOutboxModule wiring', () => {
  it('owns one lifecycle and exports only the capture boundary used by source modules', () => {
    const providers = metadata(NotificationOutboxModule, MODULE_METADATA.PROVIDERS);
    const exports = metadata(NotificationOutboxModule, MODULE_METADATA.EXPORTS);

    expect(providers.filter((provider) => provider === NotificationOutboxLifecycle)).toHaveLength(1);
    expect(exports).toEqual(expect.arrayContaining([
      NotificationOutboxConfig,
      CaptureNotificationIntentHandler,
      MaterializeNotificationIntentHandler,
      ResolveNotificationIntentOwnershipHandler,
    ]));
  });

  it('is imported by comms, people, and ops so optional rollout dependencies are live', () => {
    expect(metadata(CommsModule, MODULE_METADATA.IMPORTS)).toContain(NotificationOutboxModule);
    expect(metadata(PeopleModule, MODULE_METADATA.IMPORTS)).toContain(NotificationOutboxModule);
    expect(metadata(OpsModule, MODULE_METADATA.IMPORTS)).toContain(NotificationOutboxModule);
  });
});
