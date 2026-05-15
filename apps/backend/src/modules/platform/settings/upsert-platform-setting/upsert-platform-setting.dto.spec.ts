import 'reflect-metadata';
import { UpsertPlatformSettingDto } from './upsert-platform-setting.dto';

describe('UpsertPlatformSettingDto', () => {
  it('should be defined', () => {
    const dto = new UpsertPlatformSettingDto();
    expect(dto).toBeDefined();
  });
});
