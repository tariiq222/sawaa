import { MODULE_METADATA } from '@nestjs/common/constants';

import { CommsModule } from '../comms.module';
import { OpsModule } from '../../ops/ops.module';
import { PeopleModule } from '../../people/people.module';
import { CaptureNotificationIntentHandler } from '../../../common/notification-intent/capture-notification-intent.handler';
import { MaterializeNotificationIntentHandler } from './materialize-notification-intent.handler';
import { NotificationIntentCaptureModule } from '../../../common/notification-intent/notification-intent-capture.module';
import { NotificationOutboxConfig } from '../../../common/notification-intent/notification-outbox.config';
import { NotificationOutboxLifecycle } from './notification-outbox.lifecycle';
import { NotificationOutboxModule } from './notification-outbox.module';
import { ResolveNotificationIntentOwnershipHandler } from './resolve-notification-intent-ownership.handler';

function metadata(target: unknown, key: string): unknown[] {
  return Reflect.getMetadata(key, target as object) ?? [];
}

describe('NotificationOutboxModule wiring', () => {
  it('owns one lifecycle and keeps the capture boundary in its own module', () => {
    const providers = metadata(NotificationOutboxModule, MODULE_METADATA.PROVIDERS);
    const imports = metadata(NotificationOutboxModule, MODULE_METADATA.IMPORTS);

    expect(providers.filter((provider) => provider === NotificationOutboxLifecycle)).toHaveLength(1);
    // The capture boundary moved into NotificationIntentCaptureModule so other
    // clusters can capture intents without importing the comms graph; the
    // outbox module imports it and re-exports it, so consumers still resolve
    // the same four providers.
    expect(imports).toContain(NotificationIntentCaptureModule);
    expect(metadata(NotificationOutboxModule, MODULE_METADATA.EXPORTS)).toContain(NotificationIntentCaptureModule);
  });

  it('capture module exports the providers source modules inject', () => {
    // Exports also carry the neutral injection tokens (MNT-19) so non-comms
    // clusters can inject the port instead of the concrete class.
    const exports = metadata(NotificationIntentCaptureModule, MODULE_METADATA.EXPORTS);
    expect(exports).toEqual(expect.arrayContaining([
      NotificationOutboxConfig,
      CaptureNotificationIntentHandler,
    ]));
    // Materialize/ownership resolution stay in NotificationOutboxModule: they
    // depend on comms renderers, and no other cluster captures them.
    expect(exports).not.toContain(MaterializeNotificationIntentHandler);
    expect(exports).not.toContain(ResolveNotificationIntentOwnershipHandler);
  });

  it('is imported by comms and ops; people imports the capture module only', () => {
    expect(metadata(CommsModule, MODULE_METADATA.IMPORTS)).toContain(NotificationOutboxModule);
    expect(metadata(OpsModule, MODULE_METADATA.IMPORTS)).toContain(NotificationOutboxModule);
    // people must NOT pull the whole outbox graph: it only needs capture.
    expect(metadata(PeopleModule, MODULE_METADATA.IMPORTS)).toContain(NotificationIntentCaptureModule);
    expect(metadata(PeopleModule, MODULE_METADATA.IMPORTS)).not.toContain(NotificationOutboxModule);
  });
});
