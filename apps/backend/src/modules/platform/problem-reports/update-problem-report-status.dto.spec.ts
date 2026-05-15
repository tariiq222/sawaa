import 'reflect-metadata';
import { UpdateProblemReportStatusDto } from './update-problem-report-status.dto';

describe('UpdateProblemReportStatusDto', () => {
  it('should be defined', () => {
    const dto = new UpdateProblemReportStatusDto();
    expect(dto).toBeDefined();
  });
});
