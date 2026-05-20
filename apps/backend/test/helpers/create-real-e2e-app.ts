import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/infrastructure/database";

/**
 * Real backend e2e bootstrap helper.
 *
 * Unlike create-test-app.ts, this helper intentionally does NOT override
 * PrismaService. It boots AppModule with the real Prisma client and requires a
 * migrated test-only Postgres database reachable through REAL_E2E_DATABASE_URL.
 * The shared test/setup-e2e.ts file still mocks external network dependencies
 * (Redis clients, BullMQ, MinIO, mail, Sentry, OpenAI) so this lane validates DB
 * side effects without needing the full platform locally.
 *
 * Local prerequisites:
 * - pnpm docker:up
 * - pnpm --filter=backend prisma:migrate:deploy (or pnpm db:migrate from root)
 * - REAL_E2E_DATABASE_URL pointing at a disposable e2e database. The helper
 *   fails closed unless the database name contains `test`, `e2e`, or
 *   `sawaa_test`, and refuses prod/staging/dev database names or hosts.
 */
export async function createRealE2eApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  process.env.DATABASE_URL = getRealE2eDatabaseUrl();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.setGlobalPrefix("api/v1");

  try {
    await app.init();
    const prisma = app.get(PrismaService);
    await prisma.$queryRaw`SELECT 1`;

    return { app, prisma };
  } catch (error) {
    await app.close().catch(() => undefined);
    throw new Error(
      `Real backend e2e bootstrap failed. Ensure REAL_E2E_DATABASE_URL points to a reachable migrated test-only Postgres database before running *.real-e2e-spec.ts. Cause: ${formatError(error)}`,
    );
  }
}

function getRealE2eDatabaseUrl(): string {
  const value = process.env.REAL_E2E_DATABASE_URL?.trim();

  if (!value) {
    throw new Error(
      "REAL_E2E_DATABASE_URL is required for real backend e2e tests. Refusing to fall back to DATABASE_URL because it may point at dev/staging/prod data.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("REAL_E2E_DATABASE_URL must be a valid postgres URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error(
      "REAL_E2E_DATABASE_URL must use the postgres/postgresql protocol.",
    );
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (!databaseName || !/(test|e2e|sawaa_test)/i.test(databaseName)) {
    throw new Error(
      "REAL_E2E_DATABASE_URL database name must clearly be test-only and include test, e2e, or sawaa_test.",
    );
  }

  const inspectedTarget = `${parsed.hostname} ${databaseName}`.toLowerCase();
  const unsafeTokens = [
    "prod",
    "production",
    "staging",
    "stage",
    "dev",
    "development",
  ];
  const unsafeToken = unsafeTokens.find((token) =>
    inspectedTarget.includes(token),
  );
  if (unsafeToken) {
    throw new Error(
      `REAL_E2E_DATABASE_URL target is not allowed for real e2e tests because it contains "${unsafeToken}" in the host or database name.`,
    );
  }

  return value;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export { request };
