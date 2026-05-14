import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthenticaClient } from './authentica.client';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [AuthenticaClient],
  exports: [AuthenticaClient],
})
export class AuthenticaModule {}
