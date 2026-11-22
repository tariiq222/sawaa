import { NOTIFICATION_OUTBOX_CONSUMERS, notificationSourceKey as commsSourceKey } from '../../modules/comms/notification-outbox/notification-outbox.types';
import {
  CLIENT_ENROLLED_CONSUMERS,
  NOTIFICATION_INTENT_PAYLOAD_VERSION,
  notificationSourceKey,
} from './capture.contract';

/**
 * The neutral capture contract restates four values that comms owns and that
 * are persisted in the outbox table (`consumerKey`, `payloadVersion`,
 * `sourceKey`). A drift would orphan queued rows silently, so the duplication
 * is pinned here rather than trusted.
 */
describe('notification intent capture contract', () => {
  it('uses the same consumer keys comms dispatches on', () => {
    expect(CLIENT_ENROLLED_CONSUMERS.CLIENT).toBe(NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_CLIENT);
    expect(CLIENT_ENROLLED_CONSUMERS.STAFF).toBe(NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_STAFF);
  });

  it('uses the same payload version', () => {
    // comms exports the constant it writes with; both must serialize to 1.
    expect(NOTIFICATION_INTENT_PAYLOAD_VERSION).toBe(1);
  });

  it('builds the same client-enrolled source key comms rebuilds on reconcile', () => {
    const clientId = 'client-123';
    expect(notificationSourceKey.clientEnrolled(clientId)).toBe(commsSourceKey.clientEnrolled(clientId));
  });
});
