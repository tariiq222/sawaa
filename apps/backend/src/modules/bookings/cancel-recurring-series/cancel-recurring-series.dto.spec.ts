import 'reflect-metadata';
import { CancelRecurringSeriesDto } from './cancel-recurring-series.dto';

describe('CancelRecurringSeriesDto', () => {
  it('should be defined', () => {
    const dto = new CancelRecurringSeriesDto();
    expect(dto).toBeDefined();
  });
});
