import 'reflect-metadata';
import { LogoutDto } from './logout.dto';

describe('LogoutDto', () => {
  it('should be defined', () => {
    const dto = new LogoutDto();
    expect(dto).toBeDefined();
  });
});
