/**
 * Staff notification handlers read `organizationId` from the event payload
 * and return early without it. These tests build envelopes with the real event
 * classes and pass them through a JSON round-trip — the same serialization the
 * BullMQ event bus applies — so a publisher or envelope change that loses the
 * field fails here instead of silently stopping staff notifications.
 */
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { PaymentCompletedEvent } from '../../finance/events/payment-completed.event';
import { ClientEnrolledEvent } from '../../people/events/client-enrolled.event';
import { OnPaymentCompletedStaffHandler } from './on-payment-completed-staff.handler';
import { OnClientEnrolledStaffHandler } from './on-client-enrolled-staff.handler';

const viaQueue = <T>(envelope: T): T => JSON.parse(JSON.stringify(envelope)) as T;

function deps() {
  return {
    notify: { execute: jest.fn().mockResolvedValue(undefined) },
    staffTargets: { execute: jest.fn().mockResolvedValue([{ userId: 'staff-1' }]) },
  };
}

describe('staff notification envelopes survive the event bus', () => {
  it('payment completed reaches staff with DEFAULT_ORG_ID', async () => {
    const { notify, staffTargets } = deps();
    const handler = new OnPaymentCompletedStaffHandler(notify as never, staffTargets as never);
    const envelope = new PaymentCompletedEvent({
      paymentId: 'p1', invoiceId: 'i1', bookingId: null, amount: 41_400, currency: 'SAR', organizationId: DEFAULT_ORG_ID,
    }).toEnvelope();

    await handler.handle(viaQueue(envelope) as never);

    expect(staffTargets.execute).toHaveBeenCalledWith(expect.objectContaining({ organizationId: DEFAULT_ORG_ID }));
    expect(notify.execute).toHaveBeenCalledWith(expect.objectContaining({ organizationId: DEFAULT_ORG_ID, recipientId: 'staff-1' }));
  });

  it('client enrolled reaches staff with DEFAULT_ORG_ID', async () => {
    const { notify, staffTargets } = deps();
    const handler = new OnClientEnrolledStaffHandler(notify as never, staffTargets as never);
    const envelope = new ClientEnrolledEvent({ clientId: 'c1', name: 'سارة', organizationId: DEFAULT_ORG_ID }).toEnvelope();

    await handler.handle(viaQueue(envelope) as never);

    expect(staffTargets.execute).toHaveBeenCalledWith(expect.objectContaining({ organizationId: DEFAULT_ORG_ID }));
    expect(notify.execute).toHaveBeenCalled();
  });

  it('a payload without organizationId notifies nobody (the failure mode this guards)', async () => {
    const { notify, staffTargets } = deps();
    const handler = new OnPaymentCompletedStaffHandler(notify as never, staffTargets as never);
    const envelope = new PaymentCompletedEvent({ paymentId: 'p1', invoiceId: 'i1', bookingId: null, amount: 1, currency: 'SAR' }).toEnvelope();

    await handler.handle(viaQueue(envelope) as never);

    expect(notify.execute).not.toHaveBeenCalled();
  });
});
