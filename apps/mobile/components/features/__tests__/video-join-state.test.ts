import { getVideoJoinState } from '../video-join-state';

const start = new Date('2026-09-30T14:00:00Z').getTime();
const base = { scheduledAt: '2026-09-30T14:00:00Z', durationMins: 60, linkReady: true };

describe('getVideoJoinState', () => {
  it('is "before" earlier than 15 minutes ahead of the start', () => {
    expect(getVideoJoinState({ ...base, now: start - 16 * 60 * 1000 })).toBe('before');
  });

  it('is "open" from 15 minutes before the start until the end', () => {
    expect(getVideoJoinState({ ...base, now: start - 15 * 60 * 1000 })).toBe('open');
    expect(getVideoJoinState({ ...base, now: start + 60 * 60 * 1000 })).toBe('open');
  });

  it('is "ended" after the appointment ends', () => {
    expect(getVideoJoinState({ ...base, now: start + 60 * 60 * 1000 + 1 })).toBe('ended');
  });

  it('is "waiting" inside the window when the meeting link is not ready', () => {
    expect(getVideoJoinState({ ...base, linkReady: false, now: start })).toBe('waiting');
  });

  it('is "waiting" for an unparsable date', () => {
    expect(getVideoJoinState({ ...base, scheduledAt: 'x' })).toBe('waiting');
  });
});
