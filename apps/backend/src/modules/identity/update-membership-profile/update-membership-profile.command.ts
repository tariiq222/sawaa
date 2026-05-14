export interface UpdateMembershipProfileCommand {
  /** Caller user id (from JWT). Authorization: must own the target membership. */
  userId: string;
  /** Target membership id. */
  displayName?: string | null;
  jobTitle?: string | null;
  avatarUrl?: string | null;
}
