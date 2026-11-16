import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bigintJsonReplacer } from './json-bigint.helper';

/**
 * End-to-end proof of the production failure and its fix at the HTTP layer:
 * a controller returning a Prisma-shaped row with a `bigint` column.
 */
@Controller('bigint-probe')
class BigintProbeController {
  @Get()
  read() {
    return {
      id: 'msg-1',
      sequence: 42n,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
  }
}

async function buildApp(withReplacer: boolean): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ controllers: [BigintProbeController] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  if (withReplacer) app.set('json replacer', bigintJsonReplacer);
  await app.init();
  return app;
}

describe('BigInt HTTP serialization', () => {
  it('fails with 500 when no json replacer is registered (the pre-fix behaviour)', async () => {
    const app = await buildApp(false);
    try {
      await request(app.getHttpServer()).get('/bigint-probe').expect(500);
    } finally {
      await app.close();
    }
  });

  it('returns 200 with the bigint encoded as a number when the replacer is registered', async () => {
    const app = await buildApp(true);
    try {
      const response = await request(app.getHttpServer()).get('/bigint-probe').expect(200);
      expect(response.body).toEqual({
        id: 'msg-1',
        sequence: 42,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    } finally {
      await app.close();
    }
  });
});
