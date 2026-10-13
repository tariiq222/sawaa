import { Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppMetricsService } from '../../infrastructure/telemetry/app-metrics.service';

type LegacyPrefix = 'mobile/client' | 'public/me';

const LEGACY_PREFIXES: ReadonlyArray<{ label: LegacyPrefix; path: string }> = [
  { label: 'mobile/client', path: '/api/v1/mobile/client' },
  { label: 'public/me', path: '/api/v1/public/me' },
];

const logger = new Logger('LegacyClientPrefix');
let warnedInvalidSunset = false;

function detectPrefix(path: string): LegacyPrefix | undefined {
  for (const { label, path: base } of LEGACY_PREFIXES) {
    if (path === base || path.startsWith(`${base}/`)) return label;
  }
  return undefined;
}

function resolveSunsetHeader(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    if (!warnedInvalidSunset) {
      warnedInvalidSunset = true;
      logger.warn('CLIENT_LEGACY_PREFIX_SUNSET is not a valid date; Sunset header disabled');
    }
    return undefined;
  }
  return date.toUTCString();
}

/**
 * Marks requests on the legacy client API prefixes (`/mobile/client`,
 * `/public/me`) with `Deprecation`/`Sunset` headers and counts them so we can
 * tell when old app builds are gone. Headers and metrics only; request
 * handling is unchanged. The unified `/client` prefix is never marked.
 */
export function legacyClientPrefixMiddleware(metrics: AppMetricsService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const prefix = detectPrefix(req.path);
    if (!prefix) return next();

    res.setHeader('Deprecation', 'true');
    const sunset = resolveSunsetHeader(process.env.CLIENT_LEGACY_PREFIX_SUNSET);
    if (sunset) res.setHeader('Sunset', sunset);

    res.once('finish', () => {
      const template = req.route?.path;
      const route = typeof template === 'string' && template.length > 0 ? template : prefix;
      metrics.legacyClientPrefixRequests.inc({ prefix, route });
    });
    next();
  };
}
