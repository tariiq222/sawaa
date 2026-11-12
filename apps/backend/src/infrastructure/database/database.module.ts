import { Global, Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { PrismaService } from './prisma.service';
import { TransactionService } from '../../common/database/transaction.service';

/**
 * Global database module. Exports the shared PrismaService and
 * TransactionService so any BC can inject them without re-importing
 * DatabaseModule in its own feature module.
 */
@Global()
@Module({
  imports: [ClsModule],
  providers: [PrismaService, TransactionService],
  exports: [PrismaService, TransactionService],
})
export class DatabaseModule {}
