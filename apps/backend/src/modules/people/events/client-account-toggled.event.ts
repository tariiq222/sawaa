import { BaseEvent } from '../../../common/events';

export interface ClientAccountToggledPayload {
  clientId: string;
  isActive: boolean;
  reason?: string;
  actorUserId?: string;
}

/**
 * Emitted when an admin enables or disables a client account.
 * Other BCs can subscribe (e.g., to send a notification email).
 */
export class ClientAccountToggledEvent extends BaseEvent<ClientAccountToggledPayload> {
  readonly eventName = 'people.client.account_toggled';

  constructor(payload: ClientAccountToggledPayload) {
    super({ source: 'people', version: 1, payload });
  }
}
