import { BadRequestException } from "@nestjs/common";
import {
  isISO8601,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

// Deliberately narrower than ISO8601: calendar dates, explicit seconds and zone,
// optional millisecond precision. Week/ordinal dates and local times are not facts.
const TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
export function isLateSessionTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    TIMESTAMP.test(value) &&
    isISO8601(value, { strict: true, strictSeparator: true }) &&
    Number.isFinite(new Date(value).getTime())
  );
}
@ValidatorConstraint({ name: "lateSessionTimestamp", async: false })
export class LateSessionTimestamp implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isLateSessionTimestamp(value);
  }
  defaultMessage(): string {
    return "$property must be a valid calendar timestamp with seconds and an explicit timezone";
  }
}
export function parseLateSessionTimestamp(value: unknown): Date {
  if (!isLateSessionTimestamp(value))
    throw new BadRequestException({
      code: "INVALID_LATE_ENTRY_TIMESTAMP",
      message:
        "Use a valid calendar date and time with seconds and an explicit timezone.",
    });
  return new Date(value);
}
