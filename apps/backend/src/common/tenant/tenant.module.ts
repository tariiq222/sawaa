import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { SubdomainResolverService } from './subdomain-resolver.service';

@Global()
@Module({
  providers: [TenantContextService, SubdomainResolverService],
  exports: [TenantContextService, SubdomainResolverService],
})
export class TenantModule {}
