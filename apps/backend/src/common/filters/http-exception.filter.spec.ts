import { HttpException, ArgumentsHost } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { HttpExceptionFilter } from './http-exception.filter';
import { RequestContextStorage } from '../http/request-context';
import { AppMetricsService } from '../../infrastructure/telemetry/app-metrics.service';

jest.mock('@sentry/node', () => ({
  withScope: jest.fn((cb) => cb({ setTag: jest.fn(), setUser: jest.fn() })),
  captureException: jest.fn(),
}));

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockCls: Partial<ClsService>;
  let mockMetrics: Partial<AppMetricsService>;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(() => {
    mockCls = { get: jest.fn() };
    mockMetrics = {
      httpErrors: { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) } as any,
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      method: 'GET',
      path: '/test',
      headers: {},
      route: { path: '/test' },
    };

    filter = new HttpExceptionFilter(mockCls as ClsService, mockMetrics as AppMetricsService);
    jest.spyOn(RequestContextStorage, 'get').mockReturnValue({ requestId: 'req-1', userId: 'user-1' } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createHost = (): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as any);

  it('should handle HttpException with object response', () => {
    const exception = new HttpException({ message: 'Bad', error: 'BadRequest', code: 'ERR_1' }, 400);
    filter.catch(exception, createHost());
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.statusCode).toBe(400);
    expect(body.code).toBe('ERR_1');
  });

  it('should handle HttpException with string response', () => {
    const exception = new HttpException('Simple error', 400);
    filter.catch(exception, createHost());
    expect(mockResponse.status).toHaveBeenCalledWith(400);
  });

  it('should handle non-HttpException (5xx)', () => {
    const exception = new Error('Something broke');
    filter.catch(exception, createHost());
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
  });

  it('should handle primitive exception', () => {
    filter.catch('random string', createHost());
    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });

  it('should skip custom keys for 5xx', () => {
    const exception = new HttpException({ message: 'Server error', error: 'Error', internalCode: 'INT_1' }, 500);
    filter.catch(exception, createHost());
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.internalCode).toBeUndefined();
  });

  it('should include custom keys for 4xx', () => {
    const exception = new HttpException({ message: 'Bad', error: 'BadRequest', violations: ['v1'] }, 400);
    filter.catch(exception, createHost());
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.violations).toEqual(['v1']);
  });

  it('should work without metrics service', () => {
    const filterNoMetrics = new HttpExceptionFilter(mockCls as ClsService, null);
    const exception = new Error('Boom');
    filterNoMetrics.catch(exception, createHost());
    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });
});
