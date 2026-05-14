import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { GetEmailTemplateDto } from './get-email-template.dto';

export type GetEmailTemplateCommand = GetEmailTemplateDto;

@Injectable()
export class GetEmailTemplateHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: GetEmailTemplateCommand) {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id: cmd.id },
    });
    if (!template) return null;
    return template;
  }
}
