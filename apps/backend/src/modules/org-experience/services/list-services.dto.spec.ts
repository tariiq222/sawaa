import 'reflect-metadata';
import { ListServicesDto } from './list-services.dto';

describe('ListServicesDto', () => {
  it('should be defined', () => {
    const dto = new ListServicesDto();
    expect(dto).toBeDefined();
  });
});
