import { BranchDeactivatedEvent } from './branch-deactivated.event';

describe('BranchDeactivatedEvent', () => {
  it('should create an instance', () => {
    const event = new BranchDeactivatedEvent({} as any);
    expect(event).toBeDefined();
  });
});
