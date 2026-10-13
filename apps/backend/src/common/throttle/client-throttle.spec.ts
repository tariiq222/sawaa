import { CLIENT_THROTTLE_PROFILES, ClientThrottle, ClientThrottleProfile } from './client-throttle';

describe('ClientThrottle', () => {
  it('defines the profiles', () => {
    expect(CLIENT_THROTTLE_PROFILES).toEqual({
      read: { ttl: 60_000, limit: 120 },
      write: { ttl: 60_000, limit: 20 },
      money: { ttl: 60_000, limit: 5 },
      payment: { ttl: 60_000, limit: 3 },
      chat: { ttl: 60_000, limit: 15 },
    });
  });

  it.each(['read', 'write', 'money', 'payment', 'chat'] as ClientThrottleProfile[])(
    'sets throttler metadata for the %s profile',
    (profile) => {
      class Sample {
        @ClientThrottle(profile)
        handler() {}
      }
      const handler = Sample.prototype.handler;
      expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(CLIENT_THROTTLE_PROFILES[profile].ttl);
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(CLIENT_THROTTLE_PROFILES[profile].limit);
    },
  );
});
