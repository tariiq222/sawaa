import 'reflect-metadata';
import { BreakWindowDto } from './set-employee-breaks.dto';

describe('BreakWindowDto', () => {
  it('should be defined', () => {
    const dto = new BreakWindowDto();
    expect(dto).toBeDefined();
  });
});
