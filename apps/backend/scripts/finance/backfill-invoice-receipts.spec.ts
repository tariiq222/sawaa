import { readFileSync } from 'fs';
import { join } from 'path';
import {
  type BackfillDeps,
  type CandidateInvoice,
  type InvoiceFacts,
  classifyInvoice,
  parseCliArgs,
  resolveDatabaseUrl,
  resolveStorageTarget,
  runBackfill,
} from './backfill-invoice-receipts';

const PAID_AT = new Date('2026-10-01T10:00:00Z');
const before = new Date('2026-10-01T09:00:00Z');
const after = new Date('2026-10-01T10:00:05Z');

const inv = (o: Partial<CandidateInvoice> = {}): CandidateInvoice => ({
  id: 'inv-1', number: 7, status: 'PAID', total: 11500,
  paidAt: PAID_AT, pdfUrl: null, pdfGeneratedAt: null, bookingId: null, ...o,
});
const facts = (o: Partial<InvoiceFacts> = {}): InvoiceFacts => ({
  latestPaymentId: 'pay-1', isPreviousReceipt: false,
  hasReceiptOutboxEvent: true, bookingLateEntry: false, ...o,
});

describe('classifyInvoice', () => {
  it('A: pdf generated at/after paidAt is adopted, key normalised from a legacy URL', () => {
    const c = classifyInvoice(
      inv({ pdfUrl: 'https://minio/finance-invoices/invoices/inv-1/1.pdf', pdfGeneratedAt: after }),
      facts(),
    );
    expect(c).toEqual({
      kind: 'A', key: 'invoices/inv-1/1.pdf', issuedAt: after, paymentId: 'pay-1', unsent: false,
    });
  });

  it('A2: modern paid receipt without outbox event is flagged unsent unless late entry', () => {
    const base = inv({ pdfUrl: 'invoices/inv-1/1.pdf', pdfGeneratedAt: after });
    expect(classifyInvoice(base, facts({ hasReceiptOutboxEvent: false }))).toMatchObject({ kind: 'A', unsent: true });
    expect(classifyInvoice(base, facts({ hasReceiptOutboxEvent: false, bookingLateEntry: true }))).toMatchObject({ unsent: false });
    const old = inv({ paidAt: new Date('2026-09-01T00:00:00Z'), pdfUrl: 'k', pdfGeneratedAt: new Date('2026-09-02T00:00:00Z') });
    expect(classifyInvoice(old, facts({ hasReceiptOutboxEvent: false }))).toMatchObject({ unsent: false });
  });

  it('B: pdf generated before paidAt is stuck; only PAID can be issued', () => {
    const row = { pdfUrl: 'k', pdfGeneratedAt: before };
    expect(classifyInvoice(inv(row), facts())).toEqual({ kind: 'B', paymentId: 'pay-1', canIssue: true });
    expect(classifyInvoice(inv({ ...row, status: 'REFUNDED' }), facts())).toMatchObject({ kind: 'B', canIssue: false });
  });

  it('C: PAID without pdf and total > 0 is reported; previous receipt, free and refunded are not', () => {
    expect(classifyInvoice(inv(), facts())).toEqual({ kind: 'C' });
    expect(classifyInvoice(inv(), facts({ isPreviousReceipt: true })).kind).toBe('SKIP');
    expect(classifyInvoice(inv({ total: 0 }), facts()).kind).toBe('SKIP');
    expect(classifyInvoice(inv({ status: 'REFUNDED' }), facts()).kind).toBe('SKIP');
  });

  it('previous-receipt invoices are SKIP in every class (A, A2, B)', () => {
    const f = facts({ isPreviousReceipt: true, hasReceiptOutboxEvent: false });
    const a = inv({ pdfUrl: 'k', pdfGeneratedAt: after });
    const b = inv({ pdfUrl: 'k', pdfGeneratedAt: before });
    expect(classifyInvoice(a, f)).toEqual({ kind: 'SKIP', reason: 'previous receipt invoice' });
    expect(classifyInvoice(b, f)).toEqual({ kind: 'SKIP', reason: 'previous receipt invoice' });
    expect(classifyInvoice(inv(), f)).toEqual({ kind: 'SKIP', reason: 'previous receipt invoice' });
  });

  it('skips undated or payment-less pdf rows instead of guessing', () => {
    expect(classifyInvoice(inv({ pdfUrl: 'k', pdfGeneratedAt: null }), facts()).kind).toBe('SKIP');
    expect(classifyInvoice(inv({ pdfUrl: 'k', pdfGeneratedAt: after }), facts({ latestPaymentId: null })).kind).toBe('SKIP');
  });
});

describe('runBackfill', () => {
  function deps(rows: CandidateInvoice[], f: Record<string, InvoiceFacts> = {}) {
    const d = {
      listCandidates: jest.fn().mockResolvedValue(rows),
      loadFacts: jest.fn(async (i: CandidateInvoice) => f[i.id] ?? facts()),
      adoptReceipt: jest.fn().mockResolvedValue(true),
      issueSilently: jest.fn().mockResolvedValue(undefined),
    };
    return d satisfies BackfillDeps;
  }
  const rows = [
    inv({ id: 'a', number: 1, pdfUrl: 'ka', pdfGeneratedAt: after }),
    inv({ id: 'b', number: 2, pdfUrl: 'kb', pdfGeneratedAt: before }),
    inv({ id: 'r', number: 3, status: 'REFUNDED', pdfUrl: 'kr', pdfGeneratedAt: before }),
    inv({ id: 'c', number: 4 }),
  ];

  it('dry-run reports every class and writes nothing', async () => {
    const d = deps(rows);
    const r = await runBackfill(d, { apply: false });
    expect(r).toMatchObject({ dryRun: true, scanned: 4 });
    expect(r.adopted).toHaveLength(1);
    expect(r.stuckIssued).toHaveLength(1);
    expect(r.stuckReportOnly).toHaveLength(1);
    expect(r.missingReceipt).toHaveLength(1);
    expect(d.adoptReceipt).not.toHaveBeenCalled();
    expect(d.issueSilently).not.toHaveBeenCalled();
  });

  it('apply adopts class A and issues class B silently, never refunded or class C', async () => {
    const d = deps(rows);
    const r = await runBackfill(d, { apply: true });
    expect(d.adoptReceipt).toHaveBeenCalledTimes(1);
    expect(d.adoptReceipt).toHaveBeenCalledWith(rows[0], { key: 'ka', issuedAt: after, paymentId: 'pay-1' });
    expect(d.issueSilently).toHaveBeenCalledTimes(1);
    expect(d.issueSilently).toHaveBeenCalledWith('b', 'pay-1');
    expect(r.errors).toEqual([]);
  });

  it('collects per-invoice errors without stopping and skips concurrently receipted rows', async () => {
    const d = deps(rows);
    d.adoptReceipt.mockResolvedValue(false);
    d.issueSilently.mockRejectedValue(new Error('boom'));
    const r = await runBackfill(d, { apply: true });
    expect(r.adopted).toHaveLength(0);
    expect(r.skipped).toBe(1);
    expect(r.errors).toEqual(['#2 (b): boom']);
    expect(r.missingReceipt).toHaveLength(1);
  });
});

describe('script wiring', () => {
  it('does not boot the full AppModule for class B', () => {
    const src = readFileSync(join(__dirname, 'backfill-invoice-receipts.ts'), 'utf8');
    expect(src).not.toMatch(/app\.module|NestFactory|createApplicationContext/);
    expect(src).toContain('IssueInvoiceReceiptHandler');
  });
});

describe('CLI guards', () => {
  it('defaults to dry-run and requires an explicit non-default env var', () => {
    expect(parseCliArgs(['--database-url-env=AUDIT_DB'])).toMatchObject({ apply: false });
    expect(() => parseCliArgs([])).toThrow('--database-url-env');
    expect(() => parseCliArgs(['--database-url-env=DATABASE_URL'])).toThrow('must not be DATABASE_URL');
  });

  it('apply needs an exact confirmation and refuses production-shaped names', () => {
    expect(() => parseCliArgs(['--database-url-env=X', '--apply'])).toThrow('--confirm-database');
    const opts = parseCliArgs(['--database-url-env=X', '--apply', '--confirm-database=scratch', '--confirm-storage=localhost:9000/finance-invoices']);
    const url = (db: string) => ({ X: `postgresql://u:p@localhost:5432/${db}` });
    expect(resolveDatabaseUrl(opts, url('scratch'))).toContain('/scratch');
    expect(() => resolveDatabaseUrl(opts, url('other'))).toThrow('exactly match');
    const prod = parseCliArgs(['--database-url-env=X', '--apply', '--confirm-database=sawaa_prod', '--confirm-storage=localhost:9000/finance-invoices']);
    expect(() => resolveDatabaseUrl(prod, url('sawaa_prod'))).toThrow('Refusing');
  });

  it('apply also needs --confirm-storage; dry-run rejects it', () => {
    expect(() => parseCliArgs(['--database-url-env=X', '--apply', '--confirm-database=scratch'])).toThrow('--confirm-storage');
    expect(() => parseCliArgs(['--database-url-env=X', '--confirm-storage=a/b'])).toThrow('requires --apply');
  });
});

describe('resolveStorageTarget', () => {
  const apply = (target: string) =>
    parseCliArgs(['--database-url-env=X', '--apply', '--confirm-database=scratch', `--confirm-storage=${target}`]);
  const env = (host: string, port = '9000') => ({ MINIO_ENDPOINT: host, MINIO_PORT: port }) as NodeJS.ProcessEnv;

  it('dry-run never inspects storage', () => {
    expect(resolveStorageTarget(parseCliArgs(['--database-url-env=X']), {} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('apply requires the exact endpoint/bucket the issuer will use', () => {
    expect(resolveStorageTarget(apply('localhost:9000/finance-invoices'), env('localhost'))).toBe('localhost:9000/finance-invoices');
    expect(() => resolveStorageTarget(apply('localhost:9000/other'), env('localhost'))).toThrow('exactly match');
    expect(() => resolveStorageTarget(apply('localhost:9000/finance-invoices'), {} as NodeJS.ProcessEnv)).toThrow('MINIO_ENDPOINT');
  });

  it('apply refuses production-shaped storage hosts even when confirmed', () => {
    for (const host of ['files.sawaa.sa', 'minio.sawaa.sa', 'sawaa-minio', 'sawa.internal']) {
      expect(() => resolveStorageTarget(apply(`${host}:9000/finance-invoices`), env(host))).toThrow('Refusing');
    }
  });
});
