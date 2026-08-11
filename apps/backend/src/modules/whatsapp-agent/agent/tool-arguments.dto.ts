import { plainToInstance } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  validateSync,
} from "class-validator";

const DELIVERY_TYPES = ["IN_PERSON", "ONLINE"] as const;

export class ProposeBookingArgsDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsUUID()
  serviceId!: string;

  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  durationOptionId?: string;

  @IsString()
  @IsNotEmpty()
  scheduledAt!: string;

  @IsIn(DELIVERY_TYPES)
  deliveryType!: "IN_PERSON" | "ONLINE";

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CheckAvailabilityArgsDto {
  @IsUUID()
  employeeId!: string;

  @IsString()
  @IsNotEmpty()
  date!: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  durationOptionId?: string;

  @IsOptional()
  @IsIn(DELIVERY_TYPES)
  deliveryType?: "IN_PERSON" | "ONLINE";
}

export class ListCounselorsArgsDto {
  @IsOptional()
  @IsUUID()
  serviceId?: string;
}

export class CancelBookingArgsDto {
  @IsUUID()
  bookingId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export interface ToolValidationError {
  tool: string;
  errors: string[];
}

function formatErrors(errors: { constraints?: Record<string, string> }[]): string[] {
  return errors.flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );
}

export function validateToolArguments<T extends object>(
  toolName: string,
  dtoClass: new () => T,
  args: Record<string, unknown>,
): { value: T } | { error: ToolValidationError } {
  const instance = plainToInstance(dtoClass, args, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(instance as object, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });
  if (errors.length > 0) {
    return {
      error: { tool: toolName, errors: formatErrors(errors) },
    };
  }
  return { value: instance };
}