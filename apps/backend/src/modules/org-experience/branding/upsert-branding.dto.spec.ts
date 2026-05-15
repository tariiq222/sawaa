import 'reflect-metadata';
import { UpsertBrandingDto } from './upsert-branding.dto';

describe('UpsertBrandingDto', () => {
  it('should be defined', () => {
    const dto = new UpsertBrandingDto();
    expect(dto).toBeDefined();
  });
});
