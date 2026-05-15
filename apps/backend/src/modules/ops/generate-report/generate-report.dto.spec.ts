import 'reflect-metadata';
import { GenerateReportDto } from './generate-report.dto';

describe('GenerateReportDto', () => {
  it('should be defined', () => {
    const dto = new GenerateReportDto();
    expect(dto).toBeDefined();
  });
});
