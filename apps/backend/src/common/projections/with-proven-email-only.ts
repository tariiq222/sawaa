/**
 * Client-facing view of the client's own record: a legacy email that was never
 * proven may be fake or belong to someone else, so it is not echoed back.
 * Staff surfaces keep the stored value (with its verification state).
 *
 * Pure projection shared by identity's get-me and any other client-facing
 * surface. Lives in `common` because importing a file from `modules/people`
 * counts as a module→module edge in the boundary ratchet (ADR-002 stage 6).
 */
export function withProvenEmailOnly<T extends { email: string | null; emailVerified?: Date | null }>(client: T): T {
  // A projection without the verification state is treated as unproven.
  return 'emailVerified' in client && client.emailVerified ? client : { ...client, email: null };
}
