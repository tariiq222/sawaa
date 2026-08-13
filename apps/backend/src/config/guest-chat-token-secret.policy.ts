/**
 * Non-production values deliberately committed for test, CI, and local Docker
 * bootstraps. Production must reject only these exact fixtures, not arbitrary
 * strong secrets that happen to share a common prefix.
 */
export const NON_PRODUCTION_CHAT_GUEST_TOKEN_SECRET_FIXTURES = [
  'dev-chat-guest-token-secret-for-docker-only',
  'ci-chat-guest-token-secret-32chars-long',
  'test-chat-guest-token-secret-for-e2e-only',
] as const;

const CHAT_GUEST_TOKEN_SECRET_PLACEHOLDER_PATTERNS = [
  /change.?me/i,
  /replace.?me/i,
];

/**
 * Returns true when a value is a committed non-production fixture or a known
 * placeholder. Joi validation and bootstrap share this production policy.
 */
export function isProductionChatGuestTokenSecretPlaceholder(
  value: string | undefined,
): boolean {
  if (!value) return false;

  return (
    (NON_PRODUCTION_CHAT_GUEST_TOKEN_SECRET_FIXTURES as readonly string[]).includes(value) ||
    CHAT_GUEST_TOKEN_SECRET_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))
  );
}
