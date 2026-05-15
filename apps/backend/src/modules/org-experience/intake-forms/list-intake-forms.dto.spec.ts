import 'reflect-metadata';
import { ListIntakeFormsDto } from './list-intake-forms.dto';

describe('ListIntakeFormsDto', () => {
  it('should be defined', () => {
    const dto = new ListIntakeFormsDto();
    expect(dto).toBeDefined();
  });
});
