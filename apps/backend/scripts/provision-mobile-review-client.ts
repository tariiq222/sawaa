/** Add-only provisioning. Never overwrites an existing account or sends messages.
 * DATABASE_URL=... pnpm exec tsx scripts/provision-mobile-review-client.ts \
 *   --credentials-file /private/reviewer.json --expected-host localhost --apply
 * Without --apply only collision checks run. Secrets are never printed.
 */
import { readFileSync, statSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../src/modules/identity/shared/password.service';

async function main() {
  const arg = (name: string) => {
    const i = process.argv.indexOf(name);
    return i < 0 ? undefined : process.argv[i + 1];
  };
  const file = arg('--credentials-file');
  const expectedHost = arg('--expected-host');
  const url = process.env.DATABASE_URL;
  if (!file || !expectedHost || !url) throw new Error('Explicit credentials-file, expected-host and DATABASE_URL required');
  const target = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.hostname !== expectedHost) throw new Error('Database host does not match explicit target');
  if ((statSync(file).mode & 0o077) !== 0) throw new Error('Credentials file must be owner-only (0600)');
  const data = JSON.parse(readFileSync(file, 'utf8')) as { clientId: string; email: string; password: string };
  if (!/^[0-9a-f-]{36}$/i.test(data.clientId) || data.email !== 'apple@review.sawaa.invalid' ||
      typeof data.password !== 'string' || data.password.length < 24 || Buffer.byteLength(data.password) > 72 ||
      !/[A-Z]/.test(data.password) || !/[0-9]/.test(data.password)) throw new Error('Invalid synthetic review credentials');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis: 5000 }) });
  try {
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.client.findFirst({ where: { OR: [{ id: data.clientId }, { email: data.email }] } });
      const user = await tx.user.findFirst({ where: { email: data.email }, select: { id: true } });
      if (existing || user) throw new Error('Identity already exists: refusing overwrite, password reset or role change');
      if (!process.argv.includes('--apply')) return { status: 'dry-run-clear' };
      const passwordHash = await new PasswordService().hash(data.password);
      const client = await tx.client.create({ data: {
        id: data.clientId, email: data.email, passwordHash,
        name: 'حساب مراجعة تجريبي', firstName: 'حساب مراجعة', lastName: 'تجريبي',
        accountType: 'FULL', claimedAt: new Date(), isActive: true,
        phone: null, userId: null,
      }, select: { id: true } });
      return { status: 'created', clientId: client.id };
    }, { timeout: 15000 });
    console.log(JSON.stringify({ ...result, host: target.hostname, database: target.pathname.slice(1), messagesSent: 0 }));
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error('Review account provisioning failed; no credentials printed. Check target, collision, permissions and database availability.'); process.exitCode = 1; });
