-- Extend ReportType enum with 4 new types: OVERVIEW, CLIENTS, SERVICES, RATINGS
-- Each ALTER TYPE ... ADD VALUE is a separate statement and non-blocking in Postgres.

ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'OVERVIEW';
ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'CLIENTS';
ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'SERVICES';
ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'RATINGS';
