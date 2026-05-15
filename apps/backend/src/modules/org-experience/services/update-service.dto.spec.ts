import 'reflect-metadata';
import { UpdateServiceDto } from './update-service.dto';

describe('UpdateServiceDto', () => {
  it('should be defined', () => {
    const dto = new UpdateServiceDto();
    expect(dto).toBeDefined();
  });
});
