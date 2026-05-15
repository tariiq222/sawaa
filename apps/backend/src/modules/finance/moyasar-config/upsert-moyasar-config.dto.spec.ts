import 'reflect-metadata';
import { UpsertMoyasarConfigDto } from './upsert-moyasar-config.dto';

describe('UpsertMoyasarConfigDto', () => {
  it('should be defined', () => {
    const dto = new UpsertMoyasarConfigDto();
    expect(dto).toBeDefined();
  });
});
