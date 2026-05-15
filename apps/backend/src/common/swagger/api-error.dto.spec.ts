import 'reflect-metadata';
import { ApiErrorDto } from './api-error.dto';

describe('ApiErrorDto', () => {
  it('should be defined', () => {
    const dto = new ApiErrorDto();
    expect(dto).toBeDefined();
  });
});
