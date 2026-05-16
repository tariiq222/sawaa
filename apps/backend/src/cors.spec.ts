import { INestApplication } from '@nestjs/common';
import { configureCors } from './cors';

describe('configureCors', () => {
  let app: Partial<INestApplication>;
  let corsConfig: any;

  beforeEach(() => {
    corsConfig = null;
    app = {
      enableCors: jest.fn((config) => {
        corsConfig = config;
      }),
    };
    delete process.env.CORS_ORIGINS;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    delete process.env.CORS_ORIGINS;
    delete process.env.NODE_ENV;
  });

  it('should allow dev origins in non-production', () => {
    process.env.NODE_ENV = 'development';
    configureCors(app as INestApplication);
    expect(app.enableCors).toHaveBeenCalled();
    const originFn = corsConfig.origin;
    expect(originFn('http://localhost:3000', (_err: any, allow: any) => expect(allow).toBe(true)));
  });

  it('should block unknown origin', () => {
    process.env.NODE_ENV = 'development';
    configureCors(app as INestApplication);
    const originFn = corsConfig.origin;
    const cb = jest.fn();
    originFn('http://evil.com', cb);
    expect(cb).toHaveBeenCalledWith(expect.any(Error), false);
  });

  it('should allow no origin (same-origin)', () => {
    process.env.NODE_ENV = 'development';
    configureCors(app as INestApplication);
    const originFn = corsConfig.origin;
    const cb = jest.fn();
    originFn(undefined, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('should allow no origin in production (health checks)', () => {
    process.env.NODE_ENV = 'production';
    configureCors(app as INestApplication);
    const originFn = corsConfig.origin;
    const cb = jest.fn();
    originFn(undefined, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('should allow configured origins', () => {
    process.env.CORS_ORIGINS = 'https://app.example.com';
    process.env.NODE_ENV = 'production';
    configureCors(app as INestApplication);
    const originFn = corsConfig.origin;
    const cb = jest.fn();
    originFn('https://app.example.com', cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('should not include dev origins in production', () => {
    process.env.NODE_ENV = 'production';
    configureCors(app as INestApplication);
    const originFn = corsConfig.origin;
    const cb = jest.fn();
    originFn('http://localhost:3000', cb);
    expect(cb).toHaveBeenCalledWith(expect.any(Error), false);
  });
});
