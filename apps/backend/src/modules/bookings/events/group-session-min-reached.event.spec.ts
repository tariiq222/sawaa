import { GroupSessionMinReachedEvent } from './group-session-min-reached.event';

describe('GroupSessionMinReachedEvent', () => {
  it('should create an instance', () => {
    const event = new GroupSessionMinReachedEvent({} as any);
    expect(event).toBeDefined();
  });
});
