import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export interface GetInvoiceQuery {
  invoiceId: string;
  clientId?: string;
}

@Injectable()
export class GetInvoiceHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(query: GetInvoiceQuery) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: query.invoiceId, organizationId },
      include: {
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${query.invoiceId} not found`);
    }
    if (query.clientId && invoice.clientId !== query.clientId) {
      throw new ForbiddenException('Invoice does not belong to this client');
    }
    return invoice;
  }
}
