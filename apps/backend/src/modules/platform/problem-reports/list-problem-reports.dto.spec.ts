import 'reflect-metadata';
import { ListProblemReportsDto } from './list-problem-reports.dto';

describe('ListProblemReportsDto', () => {
  it('should be defined', () => {
    const dto = new ListProblemReportsDto();
    expect(dto).toBeDefined();
  });
});
