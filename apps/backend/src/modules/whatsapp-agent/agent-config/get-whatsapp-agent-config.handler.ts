import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface WhatsappAgentConfigView {
  aiModel: string;
  aiTemperature: number;
  aiMaxTokens: number;
  aiApiKeyConfigured: boolean;
  systemPromptAr: string;
  systemPromptEn: string;
  greetingAr: string | null;
  greetingEn: string | null;
  defaultLanguage: string;
  businessHoursOnly: boolean;
  activeDays: number[];
}

@Injectable()
export class GetWhatsappAgentConfigHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<WhatsappAgentConfigView> {
    const config = await this.prisma.whatsappAgentConfig.findFirst();
    if (!config) {
      return this.defaults();
    }

    return {
      aiModel: config.aiModel,
      aiTemperature: config.aiTemperature,
      aiMaxTokens: config.aiMaxTokens,
      aiApiKeyConfigured: !!config.aiApiKeyEncrypted,
      systemPromptAr: config.systemPromptAr,
      systemPromptEn: config.systemPromptEn,
      greetingAr: config.greetingAr,
      greetingEn: config.greetingEn,
      defaultLanguage: config.defaultLanguage,
      businessHoursOnly: config.businessHoursOnly,
      activeDays: config.activeDays,
    };
  }

  private defaults(): WhatsappAgentConfigView {
    return {
      aiModel: 'qwen/qwen3.5-plus-02-15',
      aiTemperature: 0.4,
      aiMaxTokens: 800,
      aiApiKeyConfigured: false,
      systemPromptAr:
        'أنت "مساعد سوا" لمركز سواء للاستشارات الأسرية. ساعد العملاء في حجز أو تعديل أو إلغاء استشاراتهم بنبرة ودودة ومختصرة.',
      systemPromptEn:
        'You are "Sawaa Assistant" for the Sawa Family Counseling center. Help clients book, modify, or cancel consultations in a friendly, concise tone.',
      greetingAr: 'أهلاً! أنا مساعد سوا. تبي تحجز استشارة؟',
      greetingEn: 'Hi! I am Sawaa Assistant. Want to book a consultation?',
      defaultLanguage: 'ar',
      businessHoursOnly: false,
      activeDays: [0, 1, 2, 3, 4],
    };
  }
}
