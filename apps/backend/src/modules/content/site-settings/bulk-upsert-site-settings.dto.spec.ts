import 'reflect-metadata';
import { SiteSettingEntryDto } from './bulk-upsert-site-settings.dto';

describe('SiteSettingEntryDto', () => {
  it('should be defined', () => {
    const dto = new SiteSettingEntryDto();
    expect(dto).toBeDefined();
  });
});
