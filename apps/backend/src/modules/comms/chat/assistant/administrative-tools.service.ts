import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
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
import { parseSawaaAgentDecision } from './sawaa-agent-decision';

const ALLOWED_TOOL_NAMES = [
  'getCenterInfo',
  'listServices',
  'listPractitioners',
  'getAvailability',
  'getServiceDetails',
  'compareServices',
  'getPractitionerDetails',
  'searchPublishedKnowledge',
  'listOwnAppointments',
  'prepareBooking',
  'prepareReschedule',
  'prepareCancellation',
  'replyToCustomer',
  // Compatibility aliases accepted only for internal callers; they are not
  // exposed in DEFINITIONS and therefore cannot be selected by the model.
  'searchKnowledge',
  'handoffToReception',
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

export type HandoffSummary = {
  category: 'USER_REQUESTED' | 'COMPLAINT' | 'FINANCIAL_EXCEPTION' | 'UNAVAILABLE_APPOINTMENT' | 'OTHER';
  requestSummary: string;
  desiredOutcome: string;
  serviceId?: string;
  practitionerId?: string;
  acceptableAlternatives?: string[];
};

const HANDOFF_CATEGORIES = new Set<HandoffSummary['category']>([
  'USER_REQUESTED', 'COMPLAINT', 'FINANCIAL_EXCEPTION', 'UNAVAILABLE_APPOINTMENT', 'OTHER',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORBIDDEN_HANDOFF_KEY = /clinical|diagnos|treatment|therapy|symptom|risk|emergency|provider|raw|staff|employee|user|metadata|tag|internal/i;
const FORBIDDEN_HANDOFF_CONTENT = /clinical|diagnos|treatment|therapy|symptom|risk|emergency|provider|raw payload|prompt|secret|token|password|تشخيص|سريري|علاجي|أعراض|خطر|طوارئ|مزود|تعليمات النظام|مفتاح|كلمة المرور|بيانات الدخول/i;

/** Projects model/request input into the only handoff data reception may see. */
export function parseHandoffSummary(value: unknown): HandoffSummary | null {
  if (!isPlainObject(value)) return null;
  const allowed = ['category', 'requestSummary', 'desiredOutcome', 'serviceId', 'practitionerId', 'acceptableAlternatives'];
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key) || FORBIDDEN_HANDOFF_KEY.test(key))) return null;
  const category = value.category;
  const requestSummary = boundedHandoffText(value.requestSummary, 300);
  const desiredOutcome = boundedHandoffText(value.desiredOutcome, 200);
  if (typeof category !== 'string' || !HANDOFF_CATEGORIES.has(category as HandoffSummary['category']) || !requestSummary || !desiredOutcome) return null;
  const result: HandoffSummary = { category: category as HandoffSummary['category'], requestSummary, desiredOutcome };
  for (const key of ['serviceId', 'practitionerId'] as const) {
    if (value[key] !== undefined && (typeof value[key] !== 'string' || !UUID.test(value[key]))) return null;
    if (value[key] !== undefined) result[key] = value[key];
  }
  if (value.acceptableAlternatives !== undefined) {
    if (!Array.isArray(value.acceptableAlternatives) || value.acceptableAlternatives.length > 5) return null;
    const alternatives = value.acceptableAlternatives.map((item) => boundedHandoffText(item, 120));
    if (alternatives.some((item): item is null => item === null)) return null;
    result.acceptableAlternatives = alternatives as string[];
  }
  return result;
}

function boundedHandoffText(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && Array.from(trimmed).length <= maxChars && !FORBIDDEN_HANDOFF_CONTENT.test(trimmed) ? trimmed : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

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
      name: 'getServiceDetails',
      description: 'Get one active public service by id.',
      parameters: { ...objectSchema, properties: { serviceId: { type: 'string' } }, required: ['serviceId'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compareServices',
      description: 'Compare two or three active public services by id.',
      parameters: { ...objectSchema, properties: { serviceIds: { type: 'array', minItems: 2, maxItems: 3, items: { type: 'string' } } }, required: ['serviceIds'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPractitionerDetails',
      description: 'Get one active public practitioner by id.',
      parameters: { ...objectSchema, properties: { practitionerId: { type: 'string' } }, required: ['practitionerId'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listServices',
      description: 'List public services and their exact IDs. Use this to resolve a customer-named service before preparing a booking.',
      parameters: {
        ...objectSchema,
        properties: {
          categoryId: { type: 'string' },
          query: { type: 'string', description: 'Customer-provided Arabic or English service name.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listPractitioners',
      description: 'List public practitioners and their exact IDs, service IDs, and branch IDs. Use this to resolve a customer-named practitioner before preparing a booking.',
      parameters: {
        ...objectSchema,
        properties: {
          serviceId: { type: 'string' },
          query: { type: 'string', description: 'Customer-provided Arabic or English practitioner name.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getAvailability',
      description: 'Get trusted available slots for one practitioner on one date. A booking may only use a startTime returned by this tool.',
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
      name: 'searchPublishedKnowledge',
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
      name: 'listOwnAppointments',
      description: 'List appointments for the authenticated client, or present login for a guest.',
      parameters: { ...objectSchema, properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepareBooking',
      description: 'Prepare an immutable appointment quote and confirmation card after service, practitioner, branch, modality, and an available slot are resolved. This never confirms the booking.',
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
  {
    type: 'function',
    function: {
      name: 'replyToCustomer',
      description: 'Return the single validated, side-effect-free final reply to the customer.',
      parameters: {
        ...objectSchema,
        properties: {
          reply: { type: 'string' },
          intent: { type: 'string', enum: ['SMALL_TALK', 'DISCOVER_SERVICE', 'COMPARE_OPTIONS', 'PRICE_OBJECTION', 'BOOKING', 'MANAGE_APPOINTMENT', 'HANDOFF', 'OUTSIDE_CENTER'] },
          journeyStage: { type: 'string', enum: ['EXPLORING', 'COMPARING', 'READY_TO_BOOK', 'HANDOFF'] },
          factsUsed: {
            type: 'array',
            description: 'Cite every trusted tool used for factual claims. Use an empty recordIds array only when that tool returned an empty list.',
            items: { type: 'object', additionalProperties: false, properties: { tool: { type: 'string' }, recordIds: { type: 'array', items: { type: 'string' } } }, required: ['tool', 'recordIds'] },
          },
          contextPatch: { type: 'object', additionalProperties: false, properties: { journeyStage: { type: 'string', enum: ['EXPLORING', 'COMPARING', 'READY_TO_BOOK', 'HANDOFF'] }, serviceInterestIds: { type: 'array', items: { type: 'string' } }, practitionerPreferenceIds: { type: 'array', items: { type: 'string' } }, modality: { type: 'string', enum: ['IN_PERSON', 'ONLINE'] }, preferredDays: { type: 'array', items: { type: 'string' } }, preferredTimeWindow: { type: 'string' }, budgetConcern: { type: 'boolean' }, selectedServiceId: { type: 'string' }, selectedPractitionerId: { type: 'string' } }, required: [] },
          handoffDraft: { type: 'object', additionalProperties: false, properties: { category: { type: 'string', enum: ['USER_REQUESTED', 'COMPLAINT', 'FINANCIAL_EXCEPTION', 'UNAVAILABLE_APPOINTMENT', 'OTHER'] }, requestSummary: { type: 'string' }, desiredOutcome: { type: 'string' }, serviceId: { type: 'string' }, practitionerId: { type: 'string' }, acceptableAlternatives: { type: 'array', items: { type: 'string' } } }, required: ['category', 'requestSummary', 'desiredOutcome'] },
        },
        required: ['reply', 'intent', 'journeyStage'],
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

    if (name === 'replyToCustomer') {
      const decision = parseSawaaAgentDecision(args);
      return decision ? { ok: true, data: decision } : { ok: false, error: { code: 'INVALID_ARGUMENTS' } };
    }

    try {
      switch (name) {
        case 'getCenterInfo':
          return { ok: true, data: this.projectCenterInfo(await this.branding.execute()) };
        case 'listServices': {
          const result = await this.catalog.execute();
          const categoryId = this.optionalString(args.categoryId);
          const query = this.optionalString(args.query);
          const services = result.services.filter((service) =>
            (!categoryId || service.categoryId === categoryId)
            && (!query || this.matchesLocalizedQuery(query, service.nameAr, service.nameEn)));
          return {
            ok: true,
            data: this.projectServices(services),
          };
        }
        case 'getServiceDetails': {
          const serviceId = this.requiredString(args.serviceId);
          if (!serviceId) return { ok: false, error: { code: 'INVALID_ARGUMENTS' } };
          const result = await this.catalog.execute();
          const service = result.services.find((item) => item.id === serviceId);
          return service ? { ok: true, data: this.projectServices([service]) } : { ok: true, data: [] };
        }
        case 'compareServices': {
          const ids = args.serviceIds;
          if (!Array.isArray(ids) || ids.length < 2 || ids.length > 3 || new Set(ids).size !== ids.length || ids.some((id) => !this.requiredString(id))) {
            return { ok: false, error: { code: 'INVALID_ARGUMENTS' } };
          }
          const result = await this.catalog.execute();
          const requested = ids as string[];
          const services = requested
            .map((id) => result.services.find((item) => item.id === id))
            .filter((item): item is PublicCatalogService => Boolean(item));
          return services.length === requested.length ? { ok: true, data: this.projectServices(services) } : { ok: true, data: [] };
        }
        case 'listPractitioners': {
          const result = await this.employees.execute();
          const serviceId = this.optionalString(args.serviceId);
          const query = this.optionalString(args.query);
          return {
            ok: true,
            data: this.projectPractitioners(result.filter((employee) =>
              (!serviceId || employee.serviceIds.includes(serviceId))
              && (!query || this.matchesLocalizedQuery(query, employee.nameAr, employee.nameEn)))),
          };
        }
        case 'getPractitionerDetails': {
          const practitionerId = this.requiredString(args.practitionerId);
          if (!practitionerId) return { ok: false, error: { code: 'INVALID_ARGUMENTS' } };
          const result = await this.employees.execute();
          const practitioner = result.find((employee) => employee.id === practitionerId);
          return practitioner ? { ok: true, data: this.projectPractitioners([practitioner]) } : { ok: true, data: [] };
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
            }), {
              employeeId,
              date,
              serviceId: this.optionalString(args.serviceId),
              branchId: this.optionalString(args.branchId),
              deliveryType: this.deliveryType(args.deliveryType),
            }),
          };
        }
        case 'searchPublishedKnowledge':
        case 'searchKnowledge': {
          const query = this.requiredString(args.query);
          if (!query) return { ok: false, error: { code: 'INVALID_ARGUMENTS' } };
          return { ok: true, data: this.projectKnowledge(await this.search.execute({ query, topK: 5 })) };
        }
        case 'handoffToReception': {
          return {
            ok: true,
            data: { intent: 'HANDOFF_TO_RECEPTION', optionOnly: true },
            publicMetadata: { action: 'OFFER_HANDOFF', reason: 'USER_REQUESTED' },
          };
        }
        case 'listOwnAppointments': {
          const sourceMessageId = this.contextMessageId(context);
          if (!sourceMessageId) return { ok: false, error: { code: 'INVALID_ARGUMENTS' } };
          const result = await this.listOwnAppointments.execute({
            conversationId: context.conversationId,
            clientId: context.clientId,
            sourceMessageId,
            ...this.assistantFence(context),
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
            ...this.assistantFence(context),
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
            ...this.assistantFence(context),
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
            ...this.assistantFence(context),
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

  private assistantFence(context: AdministrativeToolContext) {
    return context.stateVersion !== null
      && context.leaseOwner
      && context.dispatchAttempt !== null
      && context.sourceMessageId
      ? { assistantFence: {
        stateVersion: context.stateVersion,
        leaseOwner: context.leaseOwner,
        dispatchAttempt: context.dispatchAttempt,
        sourceMessageId: context.sourceMessageId,
      } }
      : {};
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
      id: 'center-public',
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

  private projectAvailability(
    values: unknown[],
    context: {
      employeeId: string;
      date: string;
      serviceId?: string;
      branchId?: string;
      deliveryType: 'IN_PERSON' | 'ONLINE' | null;
    },
  ): Array<Record<string, unknown>> {
    return this.capSerializedArray(values.slice(0, MAX_LIST_ITEMS).map((value) => {
      const item = this.asRecord(value);
      const startTime = this.dateText(item.startTime);
      const endTime = this.dateText(item.endTime);
      return this.compact({
        id: startTime && endTime ? this.slotId(context.employeeId, context.date, startTime, endTime) : null,
        employeeId: context.employeeId,
        serviceId: context.serviceId,
        branchId: context.branchId,
        deliveryType: context.deliveryType,
        startTime,
        endTime,
        localStart: startTime ? this.riyadhLocalTime(startTime) : null,
        timezone: 'Asia/Riyadh',
      });
    }));
  }

  private matchesLocalizedQuery(query: string, ...candidates: unknown[]): boolean {
    const normalizedQuery = this.normalizedLookupText(query);
    return normalizedQuery.length > 0 && candidates.some((candidate) => {
      const normalizedCandidate = this.normalizedLookupText(candidate);
      return normalizedCandidate.length > 0
        && (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate));
    });
  }

  private normalizedLookupText(value: unknown): string {
    return typeof value === 'string'
      ? value.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase()
      : '';
  }

  private riyadhLocalTime(value: string): string | null {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
    const year = get('year'); const month = get('month'); const day = get('day');
    const hour = get('hour'); const minute = get('minute');
    return year && month && day && hour && minute
      ? `${year}-${month}-${day} ${hour}:${minute}`
      : null;
  }

  private projectKnowledge(values: unknown[]): Array<Record<string, unknown>> {
    return this.capSerializedArray(values.slice(0, MAX_KNOWLEDGE_ITEMS).map((value) => {
      const item = this.asRecord(value);
      return this.compact({
        id: this.text(item.chunkId, 100),
        documentId: this.text(item.documentId, 100),
        content: this.text(item.content, MAX_KNOWLEDGE_CONTENT_CHARS),
        similarity: this.number(item.similarity),
      });
    }));
  }

  private slotId(employeeId: string, date: string, startTime: string, endTime: string): string {
    return `slot-${createHash('sha256').update(`${employeeId}|${date}|${startTime}|${endTime}`).digest('hex').slice(0, 20)}`;
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
