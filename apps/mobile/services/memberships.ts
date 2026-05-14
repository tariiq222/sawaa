import api from './api';

/**
 * Mirrors the backend `MembershipSummary` shape returned by
 * `GET /auth/memberships` (apps/backend/src/modules/identity/list-memberships).
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

/** Token pair shape kept for compatibility only. Mobile is single-tenant. */
export interface SwitchOrgTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export const membershipsService = {
  async list(): Promise<MembershipSummary[]> {
    const { data } = await api.get<MembershipSummary[]>('/auth/memberships');
    return data;
  },

  async switchOrganization(organizationId: string): Promise<SwitchOrgTokens> {
    void organizationId;
    throw new Error('Organization switching is disabled in Sawaa mobile.');
  },
};

/** Backwards-compatible function exports for direct callers. */
export const listMemberships = (): Promise<MembershipSummary[]> =>
  membershipsService.list();
export const switchOrganization = (
  organizationId: string,
): Promise<SwitchOrgTokens> => membershipsService.switchOrganization(organizationId);
