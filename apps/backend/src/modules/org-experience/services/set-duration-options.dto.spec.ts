import 'reflect-metadata';
import { DurationOptionInputDto } from './set-duration-options.dto';

describe('DurationOptionInputDto', () => {
  it('should be defined', () => {
    const dto = new DurationOptionInputDto();
    expect(dto).toBeDefined();
  });
});
