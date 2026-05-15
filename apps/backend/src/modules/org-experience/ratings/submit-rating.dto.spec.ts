import 'reflect-metadata';
import { SubmitRatingDto } from './submit-rating.dto';

describe('SubmitRatingDto', () => {
  it('should be defined', () => {
    const dto = new SubmitRatingDto();
    expect(dto).toBeDefined();
  });
});
