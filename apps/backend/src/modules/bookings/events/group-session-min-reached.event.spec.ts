import { GroupSessionMinReachedEvent } from './group-session-min-reached.event';

describe('GroupSessionMinReachedEvent', () => {
  it('should create an instance', () => {
    const event = new GroupSessionMinReachedEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
