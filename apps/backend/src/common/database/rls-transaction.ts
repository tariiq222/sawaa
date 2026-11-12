/**
 * Backward-compatibility shim (MNT-12). The class was renamed to
 * `TransactionService` (see ./transaction.service). These aliases are the SAME
 * class object, so Nest DI tokens are identical. Remove this file when no
 * references remain.
 */
export {
  /** @deprecated Use `TransactionService`. */
  TransactionService as RlsTransactionService,
} from './transaction.service';
export type {
  /** @deprecated Use `TransactionOptions`. */
  TransactionOptions as RlsTransactionOptions,
} from './transaction.service';
