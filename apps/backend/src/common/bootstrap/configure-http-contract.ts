import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';

/**
 * Register the HTTP contract shared by the running backend and real-DB tests.
 *
 * Production keeps implicit conversion disabled so values arriving over HTTP
 * must match the DTO's declared runtime shape. Development retains the
 * existing convenience conversion for local clients.
 */
export function configureHttpContract(
  app: INestApplication,
  profile: 'production' | 'development',
): void {
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: profile === 'development',
      },
    }),
  );
}
