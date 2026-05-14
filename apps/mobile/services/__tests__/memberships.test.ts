jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import api from '../api';
import {
  membershipsService,
  listMemberships,
  switchOrganization,
  type MembershipSummary,
} from '../memberships';

const mockedApi = api as unknown as { get: jest.Mock; post: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

const sample: MembershipSummary = {
  id: 'm1',
  organizationId: 'org-1',
  role: 'OWNER',
  isActive: true,
  organization: {
    id: 'org-1',
    slug: 'acme',
    nameAr: 'أكمي',
    nameEn: 'Acme',
    status: 'ACTIVE',
  },
};

describe('membershipsService.list / listMemberships', () => {
  it('GETs /auth/memberships', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [sample] });
    const r = await membershipsService.list();
    expect(r).toEqual([sample]);
    expect(mockedApi.get).toHaveBeenCalledWith('/auth/memberships');
  });

  it('exposes a function-form alias', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await listMemberships();
    expect(mockedApi.get).toHaveBeenCalledWith('/auth/memberships');
  });
});

describe('membershipsService.switchOrganization', () => {
  it('is disabled and does not call switch-org in the Sawaa mobile app', async () => {
    await expect(membershipsService.switchOrganization('org-2')).rejects.toThrow(
      'Organization switching is disabled in Sawaa mobile.',
    );
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('keeps the function-form alias disabled', async () => {
    await expect(switchOrganization('org-3')).rejects.toThrow(
      'Organization switching is disabled in Sawaa mobile.',
    );
    expect(mockedApi.post).not.toHaveBeenCalled();
  });
});
