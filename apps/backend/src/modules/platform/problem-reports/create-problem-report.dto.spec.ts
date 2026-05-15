import 'reflect-metadata';
import { CreateProblemReportDto } from './create-problem-report.dto';

describe('CreateProblemReportDto', () => {
  it('should be defined', () => {
    const dto = new CreateProblemReportDto();
    expect(dto).toBeDefined();
  });
});
