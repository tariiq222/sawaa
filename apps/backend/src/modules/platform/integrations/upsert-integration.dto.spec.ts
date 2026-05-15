import 'reflect-metadata';
import { UpsertIntegrationDto } from './upsert-integration.dto';

describe('UpsertIntegrationDto', () => {
  it('should be defined', () => {
    const dto = new UpsertIntegrationDto();
    expect(dto).toBeDefined();
  });
});
