import { Throttle } from '@nestjs/throttler';

/**
 * Shared rate-limit profiles for client-facing routes, so the web and mobile
 * routes for the same action always share one limit.
 *
 * - read: optional, for hot read endpoints.
 * - write: other client mutations (cancel, reschedule, rate, profile update, FCM token).
 * - money: booking create, program enrol, package-purchase init, refund request
 *   (5/min, the limit the website routes already had).
 * - payment: Moyasar invoice payment init (3/min, the stricter limit the mobile
 *   routes already had; limits card-testing abuse).
 * - chat: guest/client chat sends (15/min); each send may call the AI provider.
 */
export const CLIENT_THROTTLE_PROFILES = {
  read: { ttl: 60_000, limit: 120 },
  write: { ttl: 60_000, limit: 20 },
  money: { ttl: 60_000, limit: 5 },
  payment: { ttl: 60_000, limit: 3 },
  chat: { ttl: 60_000, limit: 15 },
} as const;

export type ClientThrottleProfile = keyof typeof CLIENT_THROTTLE_PROFILES;

export const ClientThrottle = (profile: ClientThrottleProfile) =>
  Throttle({ default: CLIENT_THROTTLE_PROFILES[profile] });
