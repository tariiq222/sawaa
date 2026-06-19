import { BadRequestException } from '@nestjs/common';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EntityRefResult =
  | { kind: 'uuid'; id: string }
  | { kind: 'ref'; ref: number };

/**
 * Parses a route parameter that may be either a UUID or a human-readable
 * reference in the format `<PREFIX>-<n>` (e.g. `GS-1024`).
 *
 * @param param   The raw string value from the route parameter.
 * @param prefix  The expected prefix (e.g. `'GS'`). Matching is case-insensitive.
 * @throws BadRequestException when the value matches neither form.
 */
export function parseEntityRef(param: string, prefix: string): EntityRefResult {
  if (UUID_REGEX.test(param)) {
    return { kind: 'uuid', id: param };
  }

  const refRegex = new RegExp(`^${prefix}-([0-9]+)$`, 'i');
  const match = refRegex.exec(param);
  if (match) {
    return { kind: 'ref', ref: Number(match[1]) };
  }

  throw new BadRequestException('Invalid identifier');
}
