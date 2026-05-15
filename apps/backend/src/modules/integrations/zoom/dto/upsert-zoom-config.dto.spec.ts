import 'reflect-metadata';
import { UpsertZoomConfigDto } from './upsert-zoom-config.dto';

describe('UpsertZoomConfigDto', () => {
  it('should be defined', () => {
    const dto = new UpsertZoomConfigDto();
    expect(dto).toBeDefined();
  });
});
