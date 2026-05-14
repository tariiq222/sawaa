import './instrument';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import * as express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { LoggingInterceptor, AuditInterceptor } from './common/interceptors';
import { PrismaService } from './infrastructure/database';
import { configureCors } from './cors';
import { setShuttingDown } from './common/shutdown.state';

async function bootstrap(): Promise<void> {
  // rawBody: true preserves the untouched request body buffer on req.rawBody,
  // required by webhook handlers (Moyasar, etc.) for HMAC signature verification.
  // Without this the body is JSON-parsed before the handler sees it and the
  // signature computed over the raw bytes would never match.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // Honor X-Forwarded-For from the upstream Nginx so req.ip is the real client IP (throttler + audit logs depend on this).
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  app.use('/api/v1/dashboard', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Too many requests, please try again later',
  }));

  app.use('/api/v1/auth', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many authentication attempts',
  }));

  app.setGlobalPrefix('api/v1');

  configureCors(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalInterceptors(new AuditInterceptor(app.get(PrismaService)));

  // ─── Swagger / OpenAPI ──────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sawaa API')
    .setDescription('Sawaa — نظام إدارة الحجوزات والمواعيد — dashboard & mobile API')
    .setVersion('2.0')
    .setContact('Sawaa Engineering', 'https://sawaa.app', 'dev@sawaa.app')
    .setLicense('Proprietary', 'https://sawaa.app/license')
    .addBearerAuth()
    .addServer('http://localhost:5100', 'Local dev')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Expose the interactive UI only outside production — the OpenAPI JSON
  // snapshot (WRITE_OPENAPI_SPEC=1) is still generated in CI regardless.
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  if (process.env.WRITE_OPENAPI_SPEC === '1') {
    const outPath = resolve(__dirname, '../openapi.json');
    // Deterministic key order so git diffs stay readable: recursively sort
    // every object's keys before serializing. JSON.stringify's replacer
    // cannot do this (arrays act as a global property allowlist and drop
    // nested keys), so we walk the tree ourselves.
    const sortKeys = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(sortKeys);
      if (value && typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>)
          .sort()
          .reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = sortKeys((value as Record<string, unknown>)[key]);
            return acc;
          }, {});
      }
      return value;
    };
    const ordered = JSON.stringify(sortKeys(document), null, 2);
    writeFileSync(outPath, ordered, 'utf-8');
    Logger.log(`OpenAPI spec written to ${outPath}`, 'Bootstrap');
    await app.close();
    return;
  }

  // ─── Production secret assertion (defense-in-depth) ───────────────────────
  // Joi validates at module load, but this runs after DI is fully wired so any
  // late-binding env override (e.g. vault agent sidecar) is also caught.
  const config = app.get(ConfigService);
  if (config.get<string>('NODE_ENV') === 'production') {
    const bannedPatterns = [/Admin@2026/i, /change.?me/i, /replace.?me/i, /dev-secret/i, /^test/i];
    for (const key of [
      'SMS_PROVIDER_ENCRYPTION_KEY',
      'ZOOM_PROVIDER_ENCRYPTION_KEY',
      'MOYASAR_ENCRYPTION_KEY',
      'EMAIL_PROVIDER_ENCRYPTION_KEY',
      'SUPER_ADMIN_PASSWORD',
    ]) {
      const v = config.get<string>(key);
      if (!v || bannedPatterns.some((p) => p.test(v))) {
        throw new Error(
          `Refusing to boot: ${key} is missing or set to a known dev placeholder`,
        );
      }
    }
  }

  const port = Number(process.env.PORT ?? 5100);

  app.enableShutdownHooks();

  let requestCount = 0;
  const server = app.getHttpServer();

  server.on('request', (req: unknown, res: { on: (event: string, fn: () => void) => void }) => {
    requestCount++;
    res.on('finish', () => { requestCount--; });
    res.on('close', () => { requestCount--; });
  });

  await app.listen(port);
  Logger.log(`Sawaa Backend listening on http://localhost:${port}`, 'Bootstrap');

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received — starting graceful shutdown');
    setShuttingDown();
    server.close(() => console.log('HTTP server closed'));
    const deadline = Date.now() + 30_000;
    while (requestCount > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 100));
    }
    console.log(`SIGTERM: ${requestCount} requests still in-flight, proceeding shutdown`);
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received — starting graceful shutdown');
    setShuttingDown();
    server.close(() => console.log('HTTP server closed'));
    const deadline = Date.now() + 30_000;
    while (requestCount > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 100));
    }
    await app.close();
    process.exit(0);
  });
}

void bootstrap();
