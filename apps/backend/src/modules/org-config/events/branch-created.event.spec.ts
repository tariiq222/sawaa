import { BranchCreatedEvent } from './branch-created.event';

describe('BranchCreatedEvent', () => {
  it('should create an instance', () => {
    const event = new BranchCreatedEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
