/**
 * PDPL consent tracking for client (website) registration.
 *
 * Registering on the website implies acceptance of the linked privacy policy
 * and terms of service (the website ships /privacy + /terms). We record the
 * version of the policy the client accepted so a future policy change can be
 * detected (re-consent prompt) without losing the original acceptance record.
 *
 * Bump this string whenever the privacy policy / terms materially change.
 */
export const PRIVACY_POLICY_VERSION = '2026-05-31';
