import type { ApplyReport } from './legacy-import.writer';
import type { LegacyImportAudit } from './legacy-import.audit';

export interface SafeLegacyImportReport {
  mode: 'dry-run' | 'apply';
  bundleSha256: string;
  targetDatabase: string;
  sourceAppointments: number;
  excludedFuture: number;
  historicalServices?: number;
  newHistoricalEmployees?: number;
  matchedCurrentEmployees?: number;
  newClients?: number;
  matchedCurrentClients?: number;
  plannedBookings: number;
  dispositions?: Record<string, number>;
  insertedBookings: number;
  technicalExceptions: number[];
  apply?: ApplyReport;
  audit?: LegacyImportAudit;
}

export function serializeSafeLegacyImportReport(
  report: SafeLegacyImportReport,
): string {
  return JSON.stringify(report, null, 2);
}
