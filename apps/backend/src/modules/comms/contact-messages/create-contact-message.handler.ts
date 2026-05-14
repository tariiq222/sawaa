import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateContactMessageDto } from './create-contact-message.dto';

@Injectable()
export class CreateContactMessageHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: CreateContactMessageDto) {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('Either phone or email is required');
    }


    return this.prisma.contactMessage.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        subject: dto.subject,
        body: dto.body,
      },
      select: { id: true, createdAt: true, status: true },
    });
  }
}
