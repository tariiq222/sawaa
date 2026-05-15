import { UserId } from './user-id.decorator';
import { ExecutionContext } from '@nestjs/common';

describe('UserId', () => {
  it('should be defined', () => {
    expect(UserId).toBeDefined();
    expect(typeof UserId).toBe('function');
  });
});
