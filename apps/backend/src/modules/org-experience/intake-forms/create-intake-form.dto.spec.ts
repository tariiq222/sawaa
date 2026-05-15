import 'reflect-metadata';
import { IntakeFieldInputDto } from './create-intake-form.dto';

describe('IntakeFieldInputDto', () => {
  it('should be defined', () => {
    const dto = new IntakeFieldInputDto();
    expect(dto).toBeDefined();
  });
});
