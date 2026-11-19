import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { PackageLedgerService } from './package-ledger.service';

/**
 * Standalone module so both `BookingsModule` and `FinanceModule` can import the
 * ledger without importing each other (which would create a module cycle and
 * require `forwardRef` — exactly what MNT-19 removes).
 */
@Module({
  imports: [DatabaseModule],
  providers: [PackageLedgerService],
  exports: [PackageLedgerService],
})
export class PackageLedgerModule {}
