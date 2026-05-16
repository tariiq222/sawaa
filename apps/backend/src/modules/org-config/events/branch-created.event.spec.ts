import { BranchCreatedEvent } from './branch-created.event';

describe('BranchCreatedEvent', () => {
  it('should create an instance', () => {
    const event = new BranchCreatedEvent({} as any);
    expect(event).toBeDefined();
  });
});
