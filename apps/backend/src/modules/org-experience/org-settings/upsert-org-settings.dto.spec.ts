import 'reflect-metadata';
import { UpsertOrgSettingsDto } from './upsert-org-settings.dto';

describe('UpsertOrgSettingsDto', () => {
  it('should be defined', () => {
    const dto = new UpsertOrgSettingsDto();
    expect(dto).toBeDefined();
  });
});
