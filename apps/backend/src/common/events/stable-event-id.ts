import { v5 as uuidv5 } from 'uuid';

// Private namespace dedicated to Sawaa domain-event identities. Changing this
// value would break outbox replay identity, so treat it as persisted data.
const SAWAA_EVENT_NAMESPACE = '97d2c8a7-779a-4ca3-b319-3adcb6b61f53';

/** Returns the same UUID for the same semantic event key. */
export function stableEventId(key: string): string {
  return uuidv5(key, SAWAA_EVENT_NAMESPACE);
}
