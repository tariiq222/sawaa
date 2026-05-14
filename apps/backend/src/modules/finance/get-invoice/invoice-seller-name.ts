import { PrismaService } from '../../../infrastructure/database';

const DEFAULT_INVOICE_SELLER_NAME = 'Deqah';

export async function resolveInvoiceSellerName(
  prisma: PrismaService,
  organizationId: string,
): Promise<string> {
  const branding = await prisma.brandingConfig.findUnique({
    where: { organizationId },
    select: { organizationNameEn: true, organizationNameAr: true },
  });

  return (
    branding?.organizationNameEn?.trim() ||
    branding?.organizationNameAr?.trim() ||
    DEFAULT_INVOICE_SELLER_NAME
  );
}
