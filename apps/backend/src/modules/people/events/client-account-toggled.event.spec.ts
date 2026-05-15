import { ClientAccountToggledEvent } from './client-account-toggled.event';

describe('ClientAccountToggledEvent', () => {
  it('should create an instance', () => {
    const event = new ClientAccountToggledEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
