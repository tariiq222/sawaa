import { BranchReactivatedEvent } from './branch-reactivated.event';

describe('BranchReactivatedEvent', () => {
  it('should create an instance', () => {
    const event = new BranchReactivatedEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
