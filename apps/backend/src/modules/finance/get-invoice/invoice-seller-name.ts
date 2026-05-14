import { PrismaService } from '../../../infrastructure/database';

const DEFAULT_INVOICE_SELLER_NAME = 'Sawaa';

export async function resolveInvoiceSellerName(
  prisma: PrismaService,
): Promise<string> {
  const branding = await prisma.brandingConfig.findFirst({
    select: { organizationNameEn: true, organizationNameAr: true },
  });

  return (
    branding?.organizationNameEn?.trim() ||
    branding?.organizationNameAr?.trim() ||
    DEFAULT_INVOICE_SELLER_NAME
  );
}
