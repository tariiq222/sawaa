import { Client } from 'pg';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../infrastructure/database';
import { GetClientPortalSummaryHandler } from '../bookings/client/get-client-portal-summary.handler';
import { ListClientInvoicesHandler } from './list-client-invoices/list-client-invoices.handler';
import { getClientOutstandingBalance } from './client-outstanding-balance.helper';

// Explicit loopback fixture only. Temporary tables shadow app tables for this
// connection and disappear on close; no persistent schema or real rows are touched.
const fixtureUrl = process.env.CLIENT_BALANCE_TEST_DATABASE_URL;
const describeFixture = fixtureUrl ? describe : describe.skip;
describeFixture('client outstanding balance on disposable PostgreSQL', () => {
  let db: Client;
  let prisma: PrismaService;
  beforeAll(async () => {
    const url = new URL(fixtureUrl!);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) {
      throw new Error('CLIENT_BALANCE_TEST_DATABASE_URL must name a loopback test database');
    }
    db = new Client({ connectionString: fixtureUrl });
    await db.connect();
    await db.query(`
      CREATE TEMP TABLE "Booking" (id text PRIMARY KEY, "clientId" text, status text);
      CREATE TEMP TABLE "Invoice" (id text PRIMARY KEY, "clientId" text, "bookingId" text, status text, total numeric);
      CREATE TEMP TABLE "Payment" (id text PRIMARY KEY, "invoiceId" text, status text, amount numeric);
    `);
    prisma = {
      $queryRaw: async (sql: Prisma.Sql) => (await db.query(sql.text, sql.values)).rows,
      booking: { count: async () => 0, findFirst: async () => null },
      invoice: { findMany: async () => [], count: async () => 50 },
    } as unknown as PrismaService;
  });
  beforeEach(async () => { await db.query('TRUNCATE "Payment", "Invoice", "Booking"'); });
  afterAll(async () => { await db?.end(); });
  async function invoice(id: string, bookingStatus: string | null, status = 'DRAFT', total = 45000, clientId = 'client-1') {
    if (bookingStatus) await db.query('INSERT INTO "Booking" VALUES ($1, $2, $3)', [id, clientId, bookingStatus]);
    await db.query('INSERT INTO "Invoice" VALUES ($1, $2, $3, $4, $5)', [id, clientId, bookingStatus ? id : null, status, total]);
  }

  it.each(['CANCELLED', 'EXPIRED'])('does not turn an unpaid %s reservation draft into client debt', async (status) => {
    await invoice('closed', status);
    await expect(getClientOutstandingBalance(prisma, 'client-1')).resolves.toBe(0);
  });
  it.each(['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'DEPOSIT_PAID', 'COMPLETED', 'NO_SHOW', 'CANCEL_REQUESTED'])('keeps the actual unpaid amount of a %s appointment', async (status) => {
    await invoice('real', status, 'DRAFT', 17000);
    await expect(getClientOutstandingBalance(prisma, 'client-1')).resolves.toBe(17000);
  });
  it('keeps issued cancellation charges and the remaining balance of a captured deposit', async () => {
    await invoice('charge', 'CANCELLED', 'ISSUED', 7000);
    await invoice('deposit', 'CANCELLED', 'PARTIALLY_PAID', 12000);
    await db.query(`INSERT INTO "Payment" VALUES ('deposit-payment', 'deposit', 'COMPLETED', 2000)`);
    await invoice('captured-draft', 'CANCELLED', 'DRAFT', 4000);
    await db.query(`INSERT INTO "Payment" VALUES ('capture', 'captured-draft', 'COMPLETED', 1000)`);
    await expect(getClientOutstandingBalance(prisma, 'client-1')).resolves.toBe(20000);
  });
  it.each(['PARTIALLY_REFUNDED', 'REFUNDED'])('does not erase a draft with %s capture history', async (status) => {
    await invoice('capture-history', 'CANCELLED', 'DRAFT', 4000);
    await db.query('INSERT INTO "Payment" VALUES ($1, $2, $3, $4)', ['history', 'capture-history', status, 1000]);
    await expect(getClientOutstandingBalance(prisma, 'client-1')).resolves.toBe(4000);
  });
  it('keeps pending payment records while removing a cancelled draft from visible debt', async () => {
    await invoice('closed', 'CANCELLED');
    await db.query(`INSERT INTO "Payment" VALUES ('pending-payment', 'closed', 'PENDING', 45000)`);
    await expect(getClientOutstandingBalance(prisma, 'client-1')).resolves.toBe(0);
    expect((await db.query('SELECT id, status FROM "Payment"')).rows).toEqual([{ id: 'pending-payment', status: 'PENDING' }]);
  });
  it('supplies the same payable amount to the portal and paginated invoice consumer', async () => {
    await invoice('cancelled-draft', 'CANCELLED');
    await invoice('real', 'CONFIRMED', 'DRAFT', 25000);
    await invoice('package', null, 'DRAFT', 6000);
    await invoice('other-client', 'CONFIRMED', 'DRAFT', 10000, 'client-2');
    await invoice('void', 'CANCELLED', 'VOID');
    await invoice('refunded', 'CANCELLED', 'REFUNDED');
    expect((await new GetClientPortalSummaryHandler(prisma).execute('client-1')).outstandingBalance).toBe(31000);
    expect(await new ListClientInvoicesHandler(prisma).execute('client-1', 5, 10)).toMatchObject({ items: [], total: 50, page: 5, outstandingBalance: 31000 });
  });
});
