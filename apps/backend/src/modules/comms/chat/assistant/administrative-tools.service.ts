import { Injectable } from '@nestjs/common';
import { BookingType } from '@prisma/client';
import type { ToolDefinition } from '../../../../infrastructure/ai/chat.adapter';
import { SemanticSearchHandler } from '../../../ai/semantic-search/semantic-search.handler';
import { GetPublicAvailabilityHandler } from '../../../bookings/availability/public/get-public-availability.handler';
import { GetPublicBrandingHandler } from '../../../org-experience/branding/public/get-public-branding.handler';
import { GetPublicCatalogHandler } from '../../../org-experience/public-catalog/get-public-catalog.handler';
import { ListPublicEmployeesHandler } from '../../../people/employees/public/list-public-employees.handler';
import { AdministrativeToolContext } from './administrative-tool-context';

const ALLOWED_TOOL_NAMES = [
  'getCenterInfo',
  'listServices',
  'listPractitioners',
  'getAvailability',
  'searchKnowledge',
  'handoffToReception',
] as const;

type AllowedToolName = (typeof ALLOWED_TOOL_NAMES)[number];
type FunctionToolDefinition = Extract<ToolDefinition, { type: 'function' }>;

const PERSONAL_BOOKING_TOOL_NAMES = new Set([
  'createBooking',
  'rescheduleBooking',
  'cancelBooking',
]);

export type AdministrativeToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: { code: 'AUTH_REQUIRED' | 'INVALID_ARGUMENTS' | 'TOOL_NOT_ALLOWED' | 'TOOL_NOT_AVAILABLE' | 'TOOL_FAILED' } };

const objectSchema = {
  type: 'object' as const,
  additionalProperties: false,
};

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
          bookingType: { type: 'string' },
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
];

@Injectable()
export class AdministrativeToolsService {
  constructor(
    private readonly catalog: GetPublicCatalogHandler,
    private readonly branding: GetPublicBrandingHandler,
    private readonly employees: ListPublicEmployeesHandler,
    private readonly availability: GetPublicAvailabilityHandler,
    private readonly search: SemanticSearchHandler,
  ) {}

  getDefinitions(): FunctionToolDefinition[] {
    return DEFINITIONS;
  }

  async execute(
    name: string,
    rawArguments: string,
    context: AdministrativeToolContext,
  ): Promise<AdministrativeToolResult> {
    if (PERSONAL_BOOKING_TOOL_NAMES.has(name)) {
      return context.clientId
        ? { ok: false, error: { code: 'TOOL_NOT_AVAILABLE' } }
        : { ok: false, error: { code: 'AUTH_REQUIRED' } };
    }
    if (!this.isAllowedToolName(name)) {
      return { ok: false, error: { code: 'TOOL_NOT_ALLOWED' } };
    }

    const args = this.parseArguments(rawArguments);
    if (!args) return { ok: false, error: { code: 'INVALID_ARGUMENTS' } };

    try {
      switch (name) {
        case 'getCenterInfo':
          return { ok: true, data: await this.branding.execute() };
        case 'listServices': {
          const result = await this.catalog.execute();
          const categoryId = this.optionalString(args.categoryId);
          return {
            ok: true,
            data: categoryId
              ? result.services.filter((service) => service.categoryId === categoryId)
              : result.services,
          };
        }
        case 'listPractitioners': {
          const result = await this.employees.execute();
          const serviceId = this.optionalString(args.serviceId);
          return {
            ok: true,
            data: serviceId
              ? result.filter((employee) => employee.serviceIds.includes(serviceId))
              : result,
          };
        }
        case 'getAvailability': {
          const employeeId = this.requiredString(args.employeeId);
          const date = this.requiredString(args.date);
          if (!employeeId || !date) return { ok: false, error: { code: 'INVALID_ARGUMENTS' } };
          return {
            ok: true,
            data: await this.availability.execute({
              employeeId,
              date,
              ...(this.optionalString(args.serviceId) ? { serviceId: String(args.serviceId) } : {}),
              ...(this.optionalString(args.branchId) ? { branchId: String(args.branchId) } : {}),
              ...(this.optionalString(args.durationOptionId) ? { durationOptionId: String(args.durationOptionId) } : {}),
              ...(this.optionalBookingType(args.bookingType) ? { bookingType: this.optionalBookingType(args.bookingType) } : {}),
              ...(args.deliveryType === 'IN_PERSON' || args.deliveryType === 'ONLINE'
                ? { deliveryType: args.deliveryType }
                : {}),
            }),
          };
        }
        case 'searchKnowledge': {
          const query = this.requiredString(args.query);
          if (!query) return { ok: false, error: { code: 'INVALID_ARGUMENTS' } };
          return { ok: true, data: await this.search.execute({ query, topK: 5 }) };
        }
        case 'handoffToReception':
          return {
            ok: true,
            data: { intent: 'HANDOFF_TO_RECEPTION', optionOnly: true },
          };
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

  private optionalBookingType(value: unknown): BookingType | 'ONLINE' | undefined {
    switch (value) {
      case BookingType.INDIVIDUAL:
      case BookingType.WALK_IN:
      case BookingType.GROUP:
      case 'ONLINE':
        return value;
      default:
        return undefined;
    }
  }
}
