import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../../common/tenant';
import { ZohoConfigService } from '../zoho-config.service';
import { UpdateConfigDto } from '../dto/connect.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../../common/tenant/tenant.constants";

@Injectable()
export class UpdateZohoConfigHandler {
  constructor(
    private readonly config: ZohoConfigService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: UpdateConfigDto): Promise<{ ok: true }> {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const existing = await this.config.require(organizationId);
    await this.config.save(organizationId, {
      ...existing,
      defaults: {
        sendOnCreate: dto.sendOnCreate ?? existing.defaults.sendOnCreate,
        itemId: dto.itemId ?? existing.defaults.itemId,
        branchId: dto.branchId ?? existing.defaults.branchId,
        paymentTerms: dto.paymentTerms ?? existing.defaults.paymentTerms,
      },
    });
    return { ok: true };
  }
}
