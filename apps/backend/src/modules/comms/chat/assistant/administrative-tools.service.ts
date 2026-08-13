import { Injectable } from '@nestjs/common';
import type { ToolDefinition } from '../../../../infrastructure/ai/chat.adapter';
import { SemanticSearchHandler } from '../../../ai/semantic-search/semantic-search.handler';
import { GetPublicAvailabilityHandler } from '../../../bookings/availability/public/get-public-availability.handler';
import { GetPublicBrandingHandler } from '../../../org-experience/branding/public/get-public-branding.handler';
import { GetPublicCatalogHandler } from '../../../org-experience/public-catalog/get-public-catalog.handler';
import { ListPublicEmployeesHandler } from '../../../people/employees/public/list-public-employees.handler';
import { AdministrativeToolContext } from './administrative-tool-context';
import type { AdministrativePublicMetadata } from './administrative-policy';
import { ListOwnAppointmentsHandler } from '../operations/list-own-appointments.handler';
import { PrepareBookingHandler } from '../operations/prepare-booking.handler';
import { PrepareRescheduleHandler } from '../operations/prepare-reschedule.handler';
import { PrepareCancellationHandler } from '../operations/prepare-cancellation.handler';
import { toOperationCardMetadata } from '../operations/chat-operation-public.mapper';

const ALLOWED_TOOL_NAMES = [
  'getCenterInfo',
  'listServices',
  'listPractitioners',
  'getAvailability',
  'searchKnowledge',
  'handoffToReception',
  'listOwnAppointments',
  'prepareBooking',
  'prepareReschedule',
  'prepareCancellation',
] as const;

type AllowedToolName = (typeof ALLOWED_TOOL_NAMES)[number];
type FunctionToolDefinition = Extract<ToolDefinition, { type: 'function' }>;
type PublicCatalogService = Awaited<ReturnType<GetPublicCatalogHandler['execute']>>['services'][number];

export type AdministrativeToolResult =
  | { ok: true; data: unknown; publicMetadata?: AdministrativePublicMetadata }
  | { ok: false; error: { code: 'AUTH_REQUIRED' | 'INVALID_ARGUMENTS' | 'TOOL_NOT_ALLOWED' | 'TOOL_NOT_AVAILABLE' | 'TOOL_FAILED' } };

export type AdministrativeServiceProjection = {
  id?: string;
  categoryId?: string;
  nameAr?: string;
  nameEn?: string;
  durationMins?: number;
  price?: number;
  currency?: string;
  showPrice?: boolean;
  showDuration?: boolean;
};

const objectSchema = {
  type: 'object' as const,
  additionalProperties: false,
};

const MAX_LIST_ITEMS = 10;
const MAX_KNOWLEDGE_ITEMS = 5;
const MAX_SHORT_TEXT_CHARS = 160;
const MAX_DESCRIPTION_CHARS = 300;
const MAX_KNOWLEDGE_CONTENT_CHARS = 1_000;
const MAX_TOOL_RESULT_CHARS = 10_000;

const DEFINITIONS: FunctionToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'getCenterInfo',
      description: 'Get public center identity and contact information.',
      parameters: { ...objectSchema, properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listServices',
      description: 'List public services, optionally limited to a category.',
      parameters: {
        ...objectSchema,
        properties: { categoryId: { type: 'string' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listPractitioners',
      description: 'List public practitioners, optionally limited to a service.',
      parameters: {
        ...objectSchema,
        properties: { serviceId: { type: 'string' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getAvailability',
      description: 'Get public available times for one practitioner on one date.',
      parameters: {
        ...objectSchema,
        properties: {
          employeeId: { type: 'string' },
          date: { type: 'string', description: 'Calendar date in YYYY-MM-DD format.' },
          serviceId: { type: 'string' },
          branchId: { type: 'string' },
          durationOptionId: { type: 'string' },
          deliveryType: { type: 'string', enum: ['IN_PERSON', 'ONLINE'] },
        },
        required: ['employeeId', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchKnowledge',
      description: 'Search the center administrative knowledge base.',
      parameters: {
        ...objectSchema,
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'handoffToReception',
      description: 'Present the option to contact reception without assigning or transferring the conversation.',
      parameters: { ...objectSchema, properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listOwnAppointments',
      description: 'List appointments for the authenticated client, or present login for a guest.',
      parameters: { ...objectSchema, properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepareBooking',
      description: 'Prepare an immutable appointment quote and confirmation card. This never confirms the booking.',
      parameters: {
        ...objectSchema,
        properties: {
          branchId: { type: 'string' },
          employeeId: { type: 'string' },
          serviceId: { type: 'string' },
          scheduledAt: { type: 'string', description: 'ISO 8601 appointment start.' },
          durationOptionId: { type: 'string' },
          deliveryType: { type: 'string', enum: ['IN_PERSON', 'ONLINE'] },
        },
        required: ['branchId', 'employeeId', 'serviceId', 'scheduledAt', 'deliveryType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepareReschedule',
      description: 'Prepare an owned appointment reschedule using its existing duration. This never confirms it.',
      parameters: {
        ...objectSchema,
        properties: {
          bookingId: { type: 'string' },
          newScheduledAt: { type: 'string', description: 'ISO 8601 appointment start.' },
        },
        required: ['bookingId', 'newScheduledAt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepareCancellation',
      description: 'Prepare an owned appointment cancellation confirmation card. This never confirms it.',
      parameters: {
        ...objectSchema,
        properties: { bookingId: { type: 'string' } },
        required: ['bookingId'],
      },
    },
  },
];

@Injectable()
export class AdministrativeToolsService {
  constructor(
    private readonly catalog: GetPublicCatalogHandler,
    private readonly branding: GetPublicBrandingHandler,
    private readonly employees: ListPublicEmployeesHandler,
    private readonly availability: GetPublicAvailabilityHandler,
    private readonly search: SemanticSearchHandler,
    private readonly listOwnAppointments: ListOwnAppointmentsHandler,
    private readonly prepareBooking: PrepareBookingHandler,
    private readonly prepareReschedule: PrepareRescheduleHandler,
    private readonly prepareCancellation: PrepareCancellationHandler,
  ) {}

  getDefinitions(): FunctionToolDefinition[] {
    return DEFINITIONS;
  }

  async execute(
    name: string,
    rawArguments: string,
    context: AdministrativeToolContext,
  ): Promise<AdministrativeToolResult> {
    if (!this.isAllowedToolName(name)) {
      return { ok: false, error: { code: 'TOOL_NOT_ALLOWED' } };
    }

    const args = this.parseArguments(rawArguments);
    if (!args) return { ok: false, error: { code: 'INVALID_ARGUMENTS' } };

    try {
      switch (name) {
        case 'getCenterInfo':
          return { ok: true, data: this.projectCenterInfo(await this.branding.execute()) };
        case 'listServices': {
          const result = await this.catalog.execute();
          const categoryId = this.optionalString(args.categoryId);
          return {
            ok: true,
            data: categoryId
              ? this.projectServices(result.services.filter((service) => service.categoryId === categoryId))
              : this.projectServices(result.services),
          };
        }
        case 'listPractitioners': {
          const result = await this.employees.execute();
          const serviceId = this.optionalString(args.serviceId);
          return {
            ok: true,
            data: serviceId
              ? this.projectPractitioners(result.filter((employee) => employee.serviceIds.includes(serviceId)))
              : this.projectPractitioners(result),
          };
        }
        case 'getAvailability': {
          const employeeId = this.requiredString(args.employeeId);
          const date = this.requiredString(args.date);
          if (!employeeId || !date) return { ok: false, error: { code: 'INVALID_ARGUMENTS' } };
          return {
            ok: true,
            data: this.projectAvailability(await this.availability.execute({
              employeeId,
              date,
              ...(this.optionalString(args.serviceId) ? { serviceId: String(args.serviceId) } : {}),
              ...(this.optionalString(args.branchId) ? { branchId: String(args.branchId) } : {}),
              ...(this.optionalString(args.durationOptionId) ? { durationOptionId: String(args.durationOptionId) } : {}),
              ...(args.deliveryType === 'IN_PERSON' || args.deliveryType === 'ONLINE'
                ? { deliveryType: args.deliveryType }
                : {}),
            })),
          };
        }
        case 'searchKnowledge': {
          const query = this.requiredString(args.query);
          if (!query) return { ok: false, error: { code: 'INVALID_ARGUMENTS' } };
          return { ok: true, data: this.projectKnowledge(await this.search.execute({ query, topK: 5 })) };
        }
        case 'handoffToReception':
          return {
            ok: true,
            data: { intent: 'HANDOFF_TO_RECEPTION', optionOnly: true },
            publicMetadata: { action: 'OFFER_HANDOFF', reason: 'USER_REQUESTED' },
          };
        case 'listOwnAppointments': {
          const sourceMessageId = this.contextMessageId(context);
          if (!sourceMessageId) return { ok: false, error: { code: 'INVALID_ARGUMENTS' } };
          const result = await this.listOwnAppointments.execute({
            conversationId: context.conversationId,
            clientId: context.clientId,
            sourceMessageId,
          });
          if (result.kind === 'AUTH_REQUIRED') {
            const publicMetadata = toOperationCardMetadata(result.operation);
            return { ok: true, data: { operation: publicMetadata.operation }, publicMetadata };
          }
          return {
            ok: true,
            data: this.projectAppointments(result.appointments.items),
          };
        }
        case 'prepareBooking': {
          const sourceMessageId = this.contextMessageId(context);
          const branchId = this.requiredString(args.branchId);
          const employeeId = this.requiredString(args.employeeId);
          const serviceId = this.requiredString(args.serviceId);
          const scheduledAt = this.requiredString(args.scheduledAt);
          const deliveryType = this.deliveryType(args.deliveryType);
          if (!sourceMessageId || !branchId || !employeeId || !serviceId || !scheduledAt || !deliveryType) {
            return { ok: false, error: { code: 'INVALID_ARGUMENTS' } };
          }
          const operation = await this.prepareBooking.execute({
            conversationId: context.conversationId,
            clientId: context.clientId,
            sourceMessageId,
            branchId,
            employeeId,
            serviceId,
            scheduledAt,
            ...(this.optionalString(args.durationOptionId)
              ? { durationOptionId: this.optionalString(args.durationOptionId) }
              : {}),
            deliveryType,
          });
          return this.operationResult(operation);
        }
        case 'prepareReschedule': {
          const sourceMessageId = this.contextMessageId(context);
          const bookingId = this.requiredString(args.bookingId);
          const newScheduledAt = this.requiredString(args.newScheduledAt);
          if (!sourceMessageId || !bookingId || !newScheduledAt) {
            return { ok: false, error: { code: 'INVALID_ARGUMENTS' } };
          }
          return this.operationResult(await this.prepareReschedule.execute({
            conversationId: context.conversationId,
            clientId: context.clientId,
            sourceMessageId,
            bookingId,
            newScheduledAt,
          }));
        }
        case 'prepareCancellation': {
          const sourceMessageId = this.contextMessageId(context);
          const bookingId = this.requiredString(args.bookingId);
          if (!sourceMessageId || !bookingId) {
            return { ok: false, error: { code: 'INVALID_ARGUMENTS' } };
          }
          return this.operationResult(await this.prepareCancellation.execute({
            conversationId: context.conversationId,
            clientId: context.clientId,
            sourceMessageId,
            bookingId,
          }));
        }
      }
    } catch {
      return { ok: false, error: { code: 'TOOL_FAILED' } };
    }
  }

  private isAllowedToolName(name: string): name is AllowedToolName {
    return (ALLOWED_TOOL_NAMES as readonly string[]).includes(name);
  }

  private parseArguments(rawArguments: string): Record<string, unknown> | null {
    try {
      const value: unknown = JSON.parse(rawArguments || '{}');
      return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }

  private requiredString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private optionalString(value: unknown): string | undefined {
    return this.requiredString(value) ?? undefined;
  }

  private deliveryType(value: unknown): 'IN_PERSON' | 'ONLINE' | null {
    return value === 'IN_PERSON' || value === 'ONLINE' ? value : null;
  }

  private contextMessageId(context: AdministrativeToolContext): string | null {
    return context.sourceMessageId && context.sourceMessageId.length > 0
      ? context.sourceMessageId
      : null;
  }

  private operationResult(operation: Parameters<typeof toOperationCardMetadata>[0]): AdministrativeToolResult {
    const publicMetadata = toOperationCardMetadata(operation);
    return { ok: true, data: { operation: publicMetadata.operation }, publicMetadata };
  }

  private projectAppointments(values: unknown[]): Array<Record<string, unknown>> {
    return this.capSerializedArray(values.slice(0, MAX_LIST_ITEMS).map((value) => {
      const item = this.asRecord(value);
      return this.compact({
        bookingId: this.text(item.id, 100),
        status: this.text(item.status, 40),
        scheduledAt: this.dateText(item.scheduledAt),
        endsAt: this.dateText(item.endsAt),
        durationMins: this.number(item.durationMins),
        serviceName: this.text(item.serviceName, MAX_SHORT_TEXT_CHARS),
        serviceNameAr: this.text(item.serviceNameAr, MAX_SHORT_TEXT_CHARS),
        employeeName: this.text(item.employeeName, MAX_SHORT_TEXT_CHARS),
        employeeNameAr: this.text(item.employeeNameAr, MAX_SHORT_TEXT_CHARS),
        branchName: this.text(item.branchName, MAX_SHORT_TEXT_CHARS),
        branchNameAr: this.text(item.branchNameAr, MAX_SHORT_TEXT_CHARS),
        deliveryType: this.text(item.deliveryType, 20),
      });
    }));
  }

  private projectCenterInfo(value: unknown): Record<string, unknown> {
    const item = this.asRecord(value);
    return this.compact({
      organizationNameAr: this.text(item.organizationNameAr, MAX_SHORT_TEXT_CHARS),
      organizationNameEn: this.text(item.organizationNameEn, MAX_SHORT_TEXT_CHARS),
      productTagline: this.text(item.productTagline, MAX_DESCRIPTION_CHARS),
      timeFormat: this.text(item.timeFormat, 8),
      contactPhone: this.text(item.contactPhone, 40),
      contactEmail: this.text(item.contactEmail, MAX_SHORT_TEXT_CHARS),
    });
  }

  private projectServices(values: PublicCatalogService[]): AdministrativeServiceProjection[] {
    return this.capSerializedArray(values.slice(0, MAX_LIST_ITEMS).map((item) => {
      return this.compact({
        id: this.text(item.id, 80),
        categoryId: this.text(item.categoryId, 80),
        nameAr: this.text(item.nameAr, MAX_SHORT_TEXT_CHARS),
        nameEn: this.text(item.nameEn, MAX_SHORT_TEXT_CHARS),
        durationMins: this.number(item.durationMins),
        price: this.number(item.price),
        currency: this.text(item.currency, 8),
        showPrice: this.boolean(item.showPrice),
        showDuration: this.boolean(item.showDuration),
      }) as AdministrativeServiceProjection;
    }));
  }

  private projectPractitioners(values: unknown[]): Array<Record<string, unknown>> {
    return this.capSerializedArray(values.slice(0, MAX_LIST_ITEMS).map((value) => {
      const item = this.asRecord(value);
      return this.compact({
        id: this.text(item.id, 80),
        nameAr: this.text(item.nameAr, MAX_SHORT_TEXT_CHARS),
        nameEn: this.text(item.nameEn, MAX_SHORT_TEXT_CHARS),
        title: this.text(item.title, MAX_SHORT_TEXT_CHARS),
        specialty: this.text(item.specialty, MAX_SHORT_TEXT_CHARS),
        specialtyAr: this.text(item.specialtyAr, MAX_SHORT_TEXT_CHARS),
        publicBioAr: this.text(item.publicBioAr, MAX_DESCRIPTION_CHARS),
        publicBioEn: this.text(item.publicBioEn, MAX_DESCRIPTION_CHARS),
        isAvailableToday: this.boolean(item.isAvailableToday),
        isBookable: this.boolean(item.isBookable),
        serviceIds: this.stringArray(item.serviceIds, MAX_LIST_ITEMS, 80),
        branchIds: this.stringArray(item.branchIds, MAX_LIST_ITEMS, 80),
        availableDaysOfWeek: this.numberArray(item.availableDaysOfWeek, 7),
      });
    }));
  }

  private projectAvailability(values: unknown[]): Array<Record<string, unknown>> {
    return this.capSerializedArray(values.slice(0, MAX_LIST_ITEMS).map((value) => {
      const item = this.asRecord(value);
      return this.compact({
        startTime: this.dateText(item.startTime),
        endTime: this.dateText(item.endTime),
      });
    }));
  }

  private projectKnowledge(values: unknown[]): Array<Record<string, unknown>> {
    return this.capSerializedArray(values.slice(0, MAX_KNOWLEDGE_ITEMS).map((value) => {
      const item = this.asRecord(value);
      return this.compact({
        content: this.text(item.content, MAX_KNOWLEDGE_CONTENT_CHARS),
        similarity: this.number(item.similarity),
      });
    }));
  }

  private capSerializedArray<T extends object>(values: T[]): T[] {
    const bounded: T[] = [];
    for (const value of values) {
      const candidate = [...bounded, value];
      if (JSON.stringify(candidate).length > MAX_TOOL_RESULT_CHARS) break;
      bounded.push(value);
    }
    return bounded;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
  }

  private text(value: unknown, maxChars: number): string | null {
    if (typeof value !== 'string') return null;
    return Array.from(value).slice(0, maxChars).join('');
  }

  private dateText(value: unknown): string | null {
    if (value instanceof Date) return value.toISOString();
    return this.text(value, 40);
  }

  private number(value: unknown): number | null {
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }

  private boolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
  }

  private stringArray(value: unknown, maxItems: number, maxChars: number): string[] | undefined {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
        .slice(0, maxItems)
        .map((item) => Array.from(item).slice(0, maxChars).join(''))
      : undefined;
  }

  private numberArray(value: unknown, maxItems: number): number[] | undefined {
    return Array.isArray(value)
      ? value.map(Number).filter(Number.isFinite).slice(0, maxItems)
      : undefined;
  }

  private compact(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(value).filter(([, field]) => field !== null && field !== undefined),
    );
  }
}
