import { BadRequestException } from '@nestjs/common';
import { DeliveryType, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database';

type BookingEligibilityDb = PrismaService | Prisma.TransactionClient;

export interface BookingTargetEligibilityInput {
  serviceId: string;
  employeeId: string;
  durationOptionId?: string | null;
  deliveryType?: DeliveryType | string | null;
  bookingType?: string | null;
}

export interface BookingTargetEligibility {
  employeeService: {
    id: string;
    employeeId: string;
    serviceId: string;
    isActive: boolean;
    disabledDeliveryTypes: DeliveryType[];
    useCustomPricing: boolean;
  };
  durationOption: {
    id: string;
    serviceId: string;
    employeeServiceId: string | null;
    deliveryType: DeliveryType;
    durationMins: number;
    isActive: boolean;
  } | null;
  deliveryType: DeliveryType;
}

function normalizeDeliveryType(value: DeliveryType | string | null | undefined): DeliveryType | undefined {
  if (typeof value !== 'string') return value ?? undefined;
  const normalized = value.toUpperCase();
  return Object.values(DeliveryType).includes(normalized as DeliveryType)
    ? (normalized as DeliveryType)
    : undefined;
}

/**
 * Validate the concrete service/practitioner/duration/delivery target used by
 * either a paid booking or a package-credit booking. This is intentionally
 * independent of pricing and availability: callers still resolve price and
 * reserve slots using their existing flows after this target gate passes.
 */
export async function validateBookingTargetEligibility(
  db: BookingEligibilityDb,
  input: BookingTargetEligibilityInput,
): Promise<BookingTargetEligibility> {
  const employeeService = await db.employeeService.findUnique({
    where: {
      employeeId_serviceId: {
        employeeId: input.employeeId,
        serviceId: input.serviceId,
      },
    },
    select: {
      id: true,
      employeeId: true,
      serviceId: true,
      isActive: true,
      disabledDeliveryTypes: true,
      useCustomPricing: true,
    },
  });

  if (!employeeService || employeeService.isActive === false) {
    throw new BadRequestException('Employee does not provide this service');
  }

  const requestedDelivery = normalizeDeliveryType(input.deliveryType);
  const scopedEmployeeServiceId = employeeService.useCustomPricing ? employeeService.id : null;
  let durationOption: BookingTargetEligibility['durationOption'] = null;

  if (input.durationOptionId) {
    durationOption = await db.serviceDurationOption.findFirst({
      where: {
        id: input.durationOptionId,
        serviceId: input.serviceId,
        employeeServiceId: scopedEmployeeServiceId,
        isActive: true,
      },
      select: {
        id: true,
        serviceId: true,
        employeeServiceId: true,
        deliveryType: true,
        durationMins: true,
        isActive: true,
      },
    });

    if (!durationOption) {
      throw new BadRequestException('Selected duration option is not offered by this practitioner');
    }
    if (durationOption.serviceId !== input.serviceId) {
      throw new BadRequestException('Duration option does not belong to the selected service');
    }
    if (durationOption.isActive === false) {
      throw new BadRequestException('Selected duration option is not offered by this practitioner');
    }

    // In inherited mode, EmployeeServiceOption can override the effective
    // minutes of a service-default duration. The booking target must carry
    // that effective value so grouped frozen snapshots cannot silently use
    // the base catalog duration after an employee override changes.
    if (!employeeService.useCustomPricing) {
      const override = await db.employeeServiceOption.findFirst({
        where: {
          employeeServiceId: employeeService.id,
          durationOptionId: durationOption.id,
          isActive: true,
        },
        select: { durationOverride: true },
      });
      if (override?.durationOverride != null) {
        durationOption = {
          ...durationOption,
          durationMins: Number(override.durationOverride),
        };
      }
    }
  } else if (employeeService.useCustomPricing && requestedDelivery) {
    // Custom practitioners may only book delivery types for which they have an
    // active owned duration. PriceResolverService applies the same scope later.
    const ownedDuration = await db.serviceDurationOption.findFirst({
      where: {
        serviceId: input.serviceId,
        deliveryType: requestedDelivery,
        employeeServiceId: employeeService.id,
        isActive: true,
      },
      select: { id: true },
    });
    if (!ownedDuration) {
      throw new BadRequestException('Practitioner does not offer this delivery type');
    }
  }

  const deliveryType = durationOption?.deliveryType ?? requestedDelivery ?? DeliveryType.IN_PERSON;
  if (durationOption && requestedDelivery && durationOption.deliveryType !== requestedDelivery) {
    throw new BadRequestException(
      `Duration option delivery type (${durationOption.deliveryType}) does not match requested delivery type (${requestedDelivery})`,
    );
  }

  if ((employeeService.disabledDeliveryTypes ?? []).includes(deliveryType)) {
    throw new BadRequestException('Practitioner does not offer this delivery type');
  }

  // Preserve the regular booking rule: a configured service must explicitly
  // enable the requested channel; no active configs remains legacy-unrestricted.
  if (input.bookingType !== 'WALK_IN') {
    const activeConfigs = await db.serviceBookingConfig.findMany({
      where: { serviceId: input.serviceId, isActive: true },
      select: { deliveryType: true },
    });
    const allowedDeliveryTypes = activeConfigs.map((config) => config.deliveryType);
    if (allowedDeliveryTypes.length > 0 && !allowedDeliveryTypes.includes(deliveryType)) {
      throw new BadRequestException(`Service does not support ${deliveryType} delivery type`);
    }
  }

  return {
    employeeService,
    durationOption,
    deliveryType,
  };
}
