import 'reflect-metadata';
import { CreateServiceDto } from './create-service.dto';

describe('CreateServiceDto', () => {
  it('should be defined', () => {
    const dto = new CreateServiceDto();
    expect(dto).toBeDefined();
  });
});
