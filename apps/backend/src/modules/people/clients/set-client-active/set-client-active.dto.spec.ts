import 'reflect-metadata';
import { SetClientActiveDto } from './set-client-active.dto';

describe('SetClientActiveDto', () => {
  it('should be defined', () => {
    const dto = new SetClientActiveDto();
    expect(dto).toBeDefined();
  });
});
