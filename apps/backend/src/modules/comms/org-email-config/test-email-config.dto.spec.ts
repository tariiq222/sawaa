import 'reflect-metadata';
import { TestEmailConfigDto } from './test-email-config.dto';

describe('TestEmailConfigDto', () => {
  it('should be defined', () => {
    const dto = new TestEmailConfigDto();
    expect(dto).toBeDefined();
  });
});
