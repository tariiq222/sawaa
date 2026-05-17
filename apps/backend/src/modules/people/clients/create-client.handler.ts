import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { ClientEnrolledEvent } from '../events/client-enrolled.event';
import { CreateClientDto } from './create-client.dto';
import { serializeClient } from './client.serializer';
import { DEFAULT_ORG_ID } from '../../../common/constants';

export type CreateClientCommand = CreateClientDto;

function composeName(firstName: string, middleName: string | undefined, lastName: string): string {
  return [firstName, middleName, lastName].filter(Boolean).join(' ').trim();
}

@Injectable()
export class CreateClientHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(dto: CreateClientCommand) {
    const orClauses: Array<{ phone?: string; email?: string }> = [];
    if (dto.phone) orClauses.push({ phone: dto.phone });
    if (dto.email) orClauses.push({ email: dto.email });

    if (orClauses.length > 0) {
      const existing = await this.prisma.client.findFirst({
        where: { OR: orClauses, deletedAt: null },
      });
      if (existing) {
        return { ...serializeClient(existing), isExisting: true };
      }
    }

    const fullName = composeName(dto.firstName, dto.middleName, dto.lastName);

    const client = await this.prisma.client.create({
      data: {
        name: fullName,
        firstName: dto.firstName,
        middleName: dto.middleName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        nationality: dto.nationality,
        nationalId: dto.nationalId,
        emergencyName: dto.emergencyName,
        emergencyPhone: dto.emergencyPhone,
        bloodType: dto.bloodType,
        allergies: dto.allergies,
        chronicConditions: dto.chronicConditions,
        avatarUrl: dto.avatarUrl,
        notes: dto.notes,
        source: dto.source,
        accountType: dto.accountType,
        isActive: dto.isActive ?? true,
        userId: dto.userId,
      },
    });

    const event = new ClientEnrolledEvent({
      clientId: client.id,
      name: client.name,
      phone: client.phone ?? undefined,
      email: client.email ?? undefined,
      organizationId: DEFAULT_ORG_ID,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    return { ...serializeClient(client), isExisting: false };
  }
}
