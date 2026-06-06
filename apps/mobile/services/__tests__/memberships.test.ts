import {
  membershipsService,
  listMemberships,
  switchOrganization,
} from '../memberships';

describe('membershipsService.list / listMemberships', () => {
  it('returns an empty list without querying memberships', async () => {
    await expect(membershipsService.list()).resolves.toEqual([]);
  });

  it('exposes a function-form alias', async () => {
    await expect(listMemberships()).resolves.toEqual([]);
  });
});

describe('membershipsService.switchOrganization', () => {
  it('is disabled and does not call switch-org in the Sawaa mobile app', async () => {
    await expect(membershipsService.switchOrganization('org-2')).rejects.toThrow(
      'Organization switching is disabled in Sawaa mobile.',
    );
  });

  it('keeps the function-form alias disabled', async () => {
    await expect(switchOrganization('org-3')).rejects.toThrow(
      'Organization switching is disabled in Sawaa mobile.',
    );
  });
});
