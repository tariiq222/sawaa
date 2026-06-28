import { ConflictException, Injectable } from '@nestjs/common';
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
    // Phone is the primary dedup key: a matching phone returns the existing client
    // (documented dedup behavior — staff intentionally land on the same record).
    if (dto.phone) {
      const existingByPhone = await this.prisma.client.findFirst({
        where: { phone: dto.phone, deletedAt: null },
      });
      if (existingByPhone) {
        return { ...serializeClient(existingByPhone), isExisting: true };
      }
    }

    // An email-only collision (different/absent phone) is rejected with a 409 so
    // staff aren't silently editing a different person's record.
    if (dto.email) {
      const existingByEmail = await this.prisma.client.findFirst({
        where: { email: dto.email, deletedAt: null },
      });
      if (existingByEmail) {
        throw new ConflictException({
          message: 'Email already registered for another client',
          code: 'CLIENT_EMAIL_EXISTS',
        });
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
