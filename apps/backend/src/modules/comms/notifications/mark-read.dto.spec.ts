import 'reflect-metadata';
import { MarkReadDto } from './mark-read.dto';

describe('MarkReadDto', () => {
  it('should be defined', () => {
    const dto = new MarkReadDto();
    expect(dto).toBeDefined();
  });
});
