import { resolveInvoiceSellerName } from './invoice-seller-name';

// ---------------------------------------------------------------------------
// resolveInvoiceSellerName
//
// Pure helper that picks the legal entity name (English → Arabic → "Sawaa")
// for invoice-level displays (ZATCA QR, public PDF rendering, the receipt
// receipt's `Seller` line). Tied to the single-tenant OrganizationSettings
// row, so a tenant can override the platform default in either language.
//
// The fallback chain is critical: an English company name WINS over an
// Arabic one, and the platform default "Sawaa" only kicks in when BOTH are
// missing. A whitespace-only English name is treated as missing.
// ---------------------------------------------------------------------------

const buildPrisma = (overrides: { companyNameEn?: string | null; companyNameAr?: string | null } = {}) => ({
  organizationSettings: {
    findFirst: jest.fn().mockResolvedValue({
      companyNameEn: overrides.companyNameEn ?? null,
      companyNameAr: overrides.companyNameAr ?? null,
    }),
  },
});

describe('resolveInvoiceSellerName', () => {
  it('returns the English company name when set', async () => {
    const prisma = buildPrisma({ companyNameEn: 'Sawaa Clinic LLC', companyNameAr: 'مركز سواء' });
    const result = await resolveInvoiceSellerName(prisma as never);
    expect(result).toBe('Sawaa Clinic LLC');
  });

  it('falls back to the Arabic company name when English is missing', async () => {
    const prisma = buildPrisma({ companyNameEn: null, companyNameAr: 'مركز سواء' });
    const result = await resolveInvoiceSellerName(prisma as never);
    expect(result).toBe('مركز سواء');
  });

  it('falls back to the platform default "Sawaa" when both names are null', async () => {
    const prisma = buildPrisma({ companyNameEn: null, companyNameAr: null });
    const result = await resolveInvoiceSellerName(prisma as never);
    expect(result).toBe('Sawaa');
  });

  it('falls back to the platform default when both names are whitespace-only', async () => {
    const prisma = buildPrisma({ companyNameEn: '   ', companyNameAr: '\t\n' });
    const result = await resolveInvoiceSellerName(prisma as never);
    expect(result).toBe('Sawaa');
  });

  it('prefers a meaningful English name over a meaningful Arabic one', async () => {
    const prisma = buildPrisma({ companyNameEn: 'Sawaa', companyNameAr: 'مركز سواء' });
    const result = await resolveInvoiceSellerName(prisma as never);
    expect(result).toBe('Sawaa');
  });

  it('falls back to Arabic when English is whitespace-only but Arabic is meaningful', async () => {
    // Whitespace-only English is treated as "missing" → Arabic wins.
    const prisma = buildPrisma({ companyNameEn: '   ', companyNameAr: 'مركز سواء' });
    const result = await resolveInvoiceSellerName(prisma as never);
    expect(result).toBe('مركز سواء');
  });

  it('falls back to platform default when OrganizationSettings row is missing entirely', async () => {
    // `findFirst` returns null on a fresh DB (no settings row yet).
    const prisma = {
      organizationSettings: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const result = await resolveInvoiceSellerName(prisma as never);
    expect(result).toBe('Sawaa');
  });

  it('trims surrounding whitespace from the resolved name', async () => {
    // Internal whitespace is preserved; only leading/trailing is stripped.
    const prisma = buildPrisma({ companyNameEn: '  Sawaa Clinic  ' });
    const result = await resolveInvoiceSellerName(prisma as never);
    expect(result).toBe('Sawaa Clinic');
  });

  it('selects only the two columns it reads (no PII or sensitive fields leaked)', async () => {
    const prisma = buildPrisma();
    await resolveInvoiceSellerName(prisma as never);
    expect(prisma.organizationSettings.findFirst).toHaveBeenCalledWith({
      select: { companyNameEn: true, companyNameAr: true },
    });
  });
});
