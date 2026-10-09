import { EmailEntryDeliveryError, MobileEmailDelivery } from '../mobile-email-entry/mobile-email-delivery';
import { MobilePhoneFlowStore } from './mobile-phone-flow.store';

export type PhoneDeliveryOutcome = 'accepted' | 'rejected' | 'unknown';

/**
 * Deliver an already-committed code OUTSIDE any database transaction, so a slow
 * SMS provider never holds row locks or a pooled connection. Until the code is
 * delivered nobody knows it, so a committed hash is not exploitable. On failure
 * the flow is closed only if it still carries this exact hash (a later resend
 * owns its own rotation).
 */
export async function deliverPhoneEntry(
  store: MobilePhoneFlowStore,
  delivery: MobileEmailDelivery,
  flow: { id: string; phone: string },
  hash: string,
  code: string,
): Promise<PhoneDeliveryOutcome> {
  try {
    await delivery.send('SMS', flow.phone, code);
    return 'accepted';
  } catch (error) {
    try {
      await store.transaction(tx => tx.mobilePhoneEntryFlow.updateMany({
        where: { id: flow.id, codeHash: hash },
        data: { state: 'FAILED', codeHash: null, continuationHash: null, continuationExpiresAt: null },
      }));
    } catch {
      // The caller still reports 503; the code was never delivered, and the
      // flow expires on its own. Keep the send budget as unknown.
      return 'unknown';
    }
    return error instanceof EmailEntryDeliveryError ? error.outcome : 'unknown';
  }
}
