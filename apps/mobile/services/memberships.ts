/**
 * Historical membership shape kept for type compatibility with existing mobile
 * imports. Sawaa mobile is single-organization and does not query memberships.
 */
export interface MembershipSummary {
  id: string;
  organizationId: string;
  role: string;
  isActive: boolean;
  organization: {
    id: string;
    slug: string;
    nameAr: string;
    nameEn: string | null;
    status: string;
  };
}

/** Token pair shape kept for compatibility with disabled switching callers. */
export interface SwitchOrgTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const ORGANIZATION_SWITCHING_DISABLED =
  'Organization switching is disabled in Sawaa mobile.';

export const membershipsService = {
  async list(): Promise<MembershipSummary[]> {
    return [];
  },

  async switchOrganization(organizationId: string): Promise<SwitchOrgTokens> {
    void organizationId;
    throw new Error(ORGANIZATION_SWITCHING_DISABLED);
  },
};

/** Backwards-compatible exports for existing direct callers. */
export const listMemberships = (): Promise<MembershipSummary[]> =>
  membershipsService.list();
export const switchOrganization = (
  organizationId: string,
): Promise<SwitchOrgTokens> => membershipsService.switchOrganization(organizationId);
