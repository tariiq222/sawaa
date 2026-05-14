import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { SubmitRatingDto } from './submit-rating.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type SubmitRatingCommand = SubmitRatingDto;

@Injectable()
export class SubmitRatingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: SubmitRatingCommand) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    if (dto.score < 1 || dto.score > 5) {
      throw new BadRequestException('Score must be between 1 and 5');
    }

    const existing = await this.prisma.rating.findUnique({
      where: { bookingId: dto.bookingId },
    });
    if (existing) throw new ConflictException('Rating already submitted for this booking');

    return this.prisma.rating.create({
      data: {
        bookingId: dto.bookingId,
        clientId: dto.clientId,
        employeeId: dto.employeeId,
        score: dto.score,
        comment: dto.comment,
        isPublic: dto.isPublic ?? false,
      },
    });
  }
}
