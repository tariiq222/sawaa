import 'reflect-metadata';
import { TestSmsConfigDto } from './test-sms-config.dto';

describe('TestSmsConfigDto', () => {
  it('should be defined', () => {
    const dto = new TestSmsConfigDto();
    expect(dto).toBeDefined();
  });
});
