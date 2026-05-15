import 'reflect-metadata';
import { SemanticSearchDto } from './semantic-search.dto';

describe('SemanticSearchDto', () => {
  it('should be defined', () => {
    const dto = new SemanticSearchDto();
    expect(dto).toBeDefined();
  });
});
