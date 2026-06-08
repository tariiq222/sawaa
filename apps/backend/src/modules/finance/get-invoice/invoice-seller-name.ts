import { PrismaService } from '../../../infrastructure/database';

const DEFAULT_INVOICE_SELLER_NAME = 'Sawaa';

export async function resolveInvoiceSellerName(
  prisma: PrismaService,
): Promise<string> {
  const settings = await prisma.organizationSettings.findFirst({
    select: { companyNameEn: true, companyNameAr: true },
  });

  return (
    settings?.companyNameEn?.trim() ||
    settings?.companyNameAr?.trim() ||
    DEFAULT_INVOICE_SELLER_NAME
  );
}
