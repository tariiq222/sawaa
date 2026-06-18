import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateBookingHandler, CreateBookingCommand } from '../create-booking/create-booking.handler';
import { CreatePublicBookingDto } from './create-public-booking.dto';

export interface CreatePublicBookingCommand
  extends Omit<CreatePublicBookingDto, 'startsAt' | 'bookingType' | 'deliveryType'> {
  clientId: string;
  scheduledAt: Date;
  bookingType?: string;
  deliveryType?: string;
}

/**
 * Thin public-surface wrapper around CreateBookingHandler.
 *
 * Responsibility: resolve the effective branchId when the caller omits it.
 * When branchId is absent:
 *   1. Use the main branch (isMain: true, isActive: true).
 *   2. Fallback to the oldest active branch (orderBy createdAt asc).
 *   3. If no active branch exists at all, throw NotFoundException.
 *
 * SECURITY: clientId is ALWAYS taken from the caller-supplied command
 * (which the controller extracts from the verified ClientSession),
 * never from the request body.
 */
@Injectable()
export class CreatePublicBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly createBookingHandler: CreateBookingHandler,
  ) {}

  async execute(command: CreatePublicBookingCommand) {
    const branchId = await this.resolveEffectiveBranchId(command.branchId);

    const delegateCommand: CreateBookingCommand = {
      branchId,
      clientId: command.clientId,
      employeeId: command.employeeId,
      serviceId: command.serviceId,
      scheduledAt: command.scheduledAt,
      durationOptionId: command.durationOptionId,
      bookingType: command.bookingType,
      deliveryType: command.deliveryType,
      couponCode: command.couponCode,
      notes: command.notes,
      source: 'ONLINE',
    };

    return this.createBookingHandler.execute(delegateCommand);
  }

  private async resolveEffectiveBranchId(branchId: string | undefined): Promise<string> {
    if (branchId) return branchId;

    // 1. Prefer the designated main branch.
    const mainBranch = await this.prisma.branch.findFirst({
      where: { isMain: true, isActive: true },
      select: { id: true },
    });
    if (mainBranch) return mainBranch.id;

    // 2. Fallback: oldest active branch.
    const fallback = await this.prisma.branch.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (fallback) return fallback.id;

    throw new NotFoundException('No active branch found');
  }
}
