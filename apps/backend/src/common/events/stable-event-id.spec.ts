import { stableEventId } from './stable-event-id';

describe('stableEventId', () => {
  it('is deterministic and separates different event actions', () => {
    expect(stableEventId('booking:1:cancel-approved'))
      .toBe(stableEventId('booking:1:cancel-approved'));
    expect(stableEventId('booking:1:cancel-approved'))
      .not.toBe(stableEventId('booking:1:zoom-reschedule'));
    expect(stableEventId('booking:1:cancel-approved'))
      .toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
