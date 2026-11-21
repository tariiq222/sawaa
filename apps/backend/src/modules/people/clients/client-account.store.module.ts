import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { CLIENT_ACCOUNT_STORE } from '../../../common/contracts/client-account.contract';
import { PgClientAccountStore } from './client-account.store';

/**
 * Standalone provider module for the `people`-owned client account store
 * (ADR-002, MNT-19.2).
 *
 * Identity imports this module directly instead of the whole `PeopleModule`.
 * `PeopleModule` imports `IdentityModule` via `forwardRef`, so wiring identity
 * → PeopleModule would create a module cycle; this module depends on
 * infrastructure and the neutral contract only, so the edge stays acyclic.
 * `PeopleModule` keeps exporting the same token, so existing consumers are
 * unaffected.
 */
@Module({
  imports: [DatabaseModule],
  providers: [PgClientAccountStore, {
    provide: CLIENT_ACCOUNT_STORE,
    useExisting: PgClientAccountStore,
  }],
  exports: [CLIENT_ACCOUNT_STORE],
})
export class ClientAccountStoreModule {}
