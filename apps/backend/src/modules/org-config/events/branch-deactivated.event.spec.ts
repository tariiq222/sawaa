import { BranchDeactivatedEvent } from './branch-deactivated.event';

describe('BranchDeactivatedEvent', () => {
  it('should create an instance', () => {
    const event = new BranchDeactivatedEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
