import { Module } from '@nestjs/common';
import { MoyasarCredentialsService } from './moyasar-credentials.service';

@Module({
  providers: [MoyasarCredentialsService],
  exports: [MoyasarCredentialsService],
})
export class PaymentsInfraModule {}
