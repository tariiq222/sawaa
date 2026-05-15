import 'reflect-metadata';
import { ListClientsDto } from './list-clients.dto';

describe('ListClientsDto', () => {
  it('should be defined', () => {
    const dto = new ListClientsDto();
    expect(dto).toBeDefined();
  });
});
