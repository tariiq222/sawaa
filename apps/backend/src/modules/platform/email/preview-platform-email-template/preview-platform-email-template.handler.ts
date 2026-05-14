import { Injectable } from '@nestjs/common';
import { GetPlatformEmailTemplateHandler } from '../get-platform-email-template/get-platform-email-template.handler';

export interface PreviewResult {
  subject: string;
  html: string;
}

@Injectable()
export class PreviewPlatformEmailTemplateHandler {
  constructor(private readonly getHandler: GetPlatformEmailTemplateHandler) {}

  async execute(slug: string, vars: Record<string, string> = {}): Promise<PreviewResult> {
    const template = await this.getHandler.execute(slug);
    const subject = this.interpolate(template.subjectEn, vars);
    const html = this.interpolate(template.htmlBody, vars);
    return { subject, html };
  }

  private interpolate(text: string, vars: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
  }
}
