import 'reflect-metadata';
import { ListDocumentsDto } from './manage-knowledge-base.dto';

describe('ListDocumentsDto', () => {
  it('should be defined', () => {
    const dto = new ListDocumentsDto();
    expect(dto).toBeDefined();
  });
});
