// booking-tools — wraps the public booking/availability API for the LLM.
//
// The agent orchestrator passes these tool definitions to ChatAdapter; the
// model returns a tool_call, we execute the matching function, and the
// result rejoins the conversation as a `tool` message.
//
// MVP approach: the agent doesn't create the booking directly. It collects
// the full intent (name, email, phone, service, employee, time, payment
// method) and writes a ContactMessage so the staff can finalize in the
// dashboard. This avoids re-implementing the slot-availability / overlap
// exclusion / price-resolution logic in two places.

import { Injectable, Optional } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";
import { GetPublicAvailabilityHandler } from "../../bookings/availability/public/get-public-availability.handler";
import { CreateBookingHandler } from "../../bookings/create-booking/create-booking.handler";
import { CreateClientHandler } from "../../people/clients/create-client.handler";
import {
  CancelBookingArgsDto,
  CheckAvailabilityArgsDto,
  ListCounselorsArgsDto,
  ProposeBookingArgsDto,
  validateToolArguments,
} from "./tool-arguments.dto";

export interface ToolContext {
  phone: string;
  conversationId?: string;
}

export const PENDING_PROPOSAL_TTL_MS = 15 * 60 * 1000;

interface CollectedIntent {
  firstName?: string;
  lastName?: string;
  email?: string;
  serviceId?: string;
  employeeId?: string;
  branchId?: string;
  durationOptionId?: string;
  scheduledAt?: string;
  deliveryType?: "IN_PERSON" | "ONLINE";
  notes?: string;
}

@Injectable()
export class BookingToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicAvailability: GetPublicAvailabilityHandler,
    @Optional() private readonly createBooking?: CreateBookingHandler,
    @Optional() private readonly createClient?: CreateClientHandler,
  ) {}

  listTools(allowedNames?: readonly string[]) {
    const tools = [
      {
        type: "function" as const,
        function: {
          name: "listServices",
          description:
            "List available consultation services (id, nameAr, nameEn, durations, prices).",
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "listCounselors",
          description:
            "List public counselors (id, name, nameAr, bio). Optionally filter by serviceId. Always use this before telling the customer a requested counselor is unavailable.",
          parameters: {
            type: "object",
            properties: {
              serviceId: {
                type: "string",
                description: "Optional service UUID to filter by",
              },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "checkAvailability",
          description:
            "Return exact currently bookable slots for a counselor on a date.",
          parameters: {
            type: "object",
            properties: {
              employeeId: { type: "string" },
              date: { type: "string", description: "YYYY-MM-DD" },
              serviceId: { type: "string" },
              branchId: { type: "string" },
              durationOptionId: { type: "string" },
              deliveryType: { type: "string", enum: ["IN_PERSON", "ONLINE"] },
            },
            required: ["employeeId", "date"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "proposeBooking",
          description:
            "Prepare a booking summary after collecting all details. This does not create a client or booking; the customer must confirm in a later message.",
          parameters: {
            type: "object",
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              email: { type: "string" },
              serviceId: { type: "string" },
              employeeId: { type: "string" },
              branchId: { type: "string" },
              durationOptionId: { type: "string" },
              scheduledAt: { type: "string", description: "ISO 8601 datetime" },
              deliveryType: { type: "string", enum: ["IN_PERSON", "ONLINE"] },
              notes: { type: "string" },
            },
            required: [
              "firstName",
              "lastName",
              "serviceId",
              "employeeId",
              "scheduledAt",
              "deliveryType",
            ],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "lookupClient",
          description:
            "Look up an existing client by phone. Returns { found: true, clientId, name } or { found: false }.",
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "listMyBookings",
          description: "List the upcoming bookings for this phone number.",
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "cancelBookingRequest",
          description:
            "Record a cancellation request. Staff will finalize in the dashboard.",
          parameters: {
            type: "object",
            properties: {
              bookingId: { type: "string" },
              reason: { type: "string" },
            },
            required: ["bookingId"],
            additionalProperties: false,
          },
        },
      },
    ];
    return allowedNames
      ? tools.filter((tool) => allowedNames.includes(tool.function.name))
      : tools;
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<unknown> {
    switch (toolName) {
      case "listServices":
        return this.listServices();
      case "listCounselors": {
        const validation = validateToolArguments(
          toolName,
          ListCounselorsArgsDto,
          args,
        );
        if ("error" in validation) return validation.error;
        return this.listCounselors(validation.value.serviceId);
      }
      case "checkAvailability": {
        const validation = validateToolArguments(
          toolName,
          CheckAvailabilityArgsDto,
          args,
        );
        if ("error" in validation) return validation.error;
        return this.checkAvailability(validation.value);
      }
      case "proposeBooking": {
        const validation = validateToolArguments(
          toolName,
          ProposeBookingArgsDto,
          args,
        );
        if ("error" in validation) return validation.error;
        return this.proposeBooking(ctx, validation.value);
      }
      case "lookupClient":
        return this.lookupClient(ctx.phone);
      case "listMyBookings":
        return this.listMyBookings(ctx.phone);
      case "cancelBookingRequest": {
        const validation = validateToolArguments(
          toolName,
          CancelBookingArgsDto,
          args,
        );
        if ("error" in validation) return validation.error;
        return this.cancelBookingRequest(
          ctx.phone,
          validation.value.bookingId,
          validation.value.reason,
        );
      }
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  async getPendingBooking(
    conversationId: string,
  ): Promise<{
    intent: CollectedIntent;
    proposalId: string;
    expiresAt: Date;
  } | null> {
    const conversation = await this.prisma.whatsappConversation.findUnique({
      where: { id: conversationId },
      select: { context: true },
    });
    const context = conversation?.context;
    if (!context || typeof context !== "object" || Array.isArray(context))
      return null;
    const pending = (context as { pendingBooking?: unknown }).pendingBooking;
    const proposalId = (context as { pendingProposalId?: unknown })
      .pendingProposalId;
    const expiresAtIso = (context as { pendingProposalExpiresAt?: unknown })
      .pendingProposalExpiresAt;
    if (
      !pending ||
      typeof pending !== "object" ||
      typeof proposalId !== "string" ||
      typeof expiresAtIso !== "string"
    ) {
      return null;
    }
    const expiresAt = new Date(expiresAtIso);
    if (Number.isNaN(expiresAt.getTime())) return null;
    if (expiresAt.getTime() <= Date.now()) return null;
    return {
      intent: pending as CollectedIntent,
      proposalId,
      expiresAt,
    };
  }

  async clearPendingBooking(conversationId: string): Promise<void> {
    const conversation = await this.prisma.whatsappConversation.findUnique({
      where: { id: conversationId },
      select: { context: true },
    });
    const context = conversation?.context;
    const nextContext =
      context && typeof context === "object" && !Array.isArray(context)
        ? (context as Record<string, unknown>)
        : {};
    await this.prisma.whatsappConversation.update({
      where: { id: conversationId },
      data: {
        context: {
          ...nextContext,
          pendingBooking: null,
          pendingProposalId: null,
          pendingProposalExpiresAt: null,
        },
      },
    });
  }

  async rejectPendingBooking(conversationId: string): Promise<void> {
    await this.clearPendingBooking(conversationId);
  }

  async confirmPendingBooking(phone: string, conversationId: string) {
    const pending = await this.getPendingBooking(conversationId);
    if (!pending || !this.createBooking || !this.createClient) {
      throw new Error("No pending booking is ready to confirm");
    }
    const intent = pending.intent;

    let client = await this.prisma.client.findFirst({
      where: { phone, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!client) {
      const created = await this.createClient.execute({
        firstName: intent.firstName!,
        lastName: intent.lastName!,
        phone,
        email: intent.email,
        source: "WHATSAPP",
        accountType: "WALK_IN",
        isActive: true,
      });
      client = { id: created.id, name: created.name };
    }

    const branchId = intent.branchId ?? (await this.resolveDefaultBranchId());
    const booking = await this.createBooking.execute({
      branchId,
      clientId: client.id,
      employeeId: intent.employeeId!,
      serviceId: intent.serviceId!,
      durationOptionId: intent.durationOptionId,
      scheduledAt: new Date(intent.scheduledAt!),
      bookingType: "INDIVIDUAL",
      deliveryType: intent.deliveryType ?? "IN_PERSON",
      source: "WHATSAPP",
      payAtClinic: true,
      notes: intent.notes,
    });

    await this.prisma.whatsappConversation.update({
      where: { id: conversationId },
      data: {
        clientId: client.id,
        context: {
          activeSpecialist: "NEW_BOOKING",
          pendingBooking: null,
          pendingProposalId: null,
          pendingProposalExpiresAt: null,
          lastBookingId: booking.id,
        },
      },
    });
    return {
      bookingNumber: booking.bookingNumber,
      scheduledAt: booking.scheduledAt,
      clientName: client.name,
      proposalId: pending.proposalId,
    };
  }

  // ── Tool implementations ──────────────────────────────────────────────────

  private async listServices() {
    const services = await this.prisma.service.findMany({
      where: { isActive: true, isHidden: false },
      orderBy: { nameAr: "asc" },
      take: 30,
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        durationMins: true,
        durationOptions: {
          where: { isActive: true },
          orderBy: { durationMins: "asc" },
          select: { id: true, durationMins: true, price: true },
        },
      },
    });
    return services.map((s) => ({
      id: s.id,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      durationMins: s.durationMins,
      durationOptions: s.durationOptions.map(
        (d: { id: string; durationMins: number; price: unknown }) => ({
          id: d.id,
          durationMins: d.durationMins,
          price: Number(d.price),
        }),
      ),
    }));
  }

  private async listCounselors(serviceId?: string) {
    const where: Record<string, unknown> = {
      isActive: true,
      isPublic: true,
    };
    if (serviceId) {
      where["services"] = {
        some: { serviceId, isActive: true },
      };
    }
    const employees = await this.prisma.employee.findMany({
      where,
      take: 30,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        nameAr: true,
        bio: true,
        avatarUrl: true,
      },
    });
    return employees.map((e) => ({
      id: e.id,
      name: e.name,
      nameAr: e.nameAr,
      bio: e.bio,
      avatarUrl: e.avatarUrl,
    }));
  }

  private async checkAvailability(args: CheckAvailabilityArgsDto) {
    const date = args.date;
    const slots = await this.publicAvailability.execute({
      employeeId: args.employeeId,
      date,
      serviceId: args.serviceId,
      branchId: args.branchId,
      durationOptionId: args.durationOptionId,
      deliveryType: args.deliveryType,
    });
    return {
      available: slots.length > 0,
      date,
      slots: slots.map((slot) => ({
        startTime: slot.startTime.toISOString(),
        endTime: slot.endTime.toISOString(),
      })),
    };
  }

  private async proposeBooking(
    ctx: ToolContext,
    args: ProposeBookingArgsDto,
  ): Promise<unknown> {
    if (!ctx.conversationId)
      throw new Error("Conversation context is required");
    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();
    const scheduledAt = args.scheduledAt;
    const scheduledAtDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledAtDate.getTime()))
      throw new Error("Invalid booking date");

    const intent: CollectedIntent = {
      firstName,
      lastName,
      email: args.email,
      serviceId: args.serviceId,
      employeeId: args.employeeId,
      branchId: args.branchId,
      durationOptionId: args.durationOptionId,
      scheduledAt,
      deliveryType: args.deliveryType,
      notes: args.notes,
    };

    const conversation = await this.prisma.whatsappConversation.findUnique({
      where: { id: ctx.conversationId },
      select: { context: true },
    });
    const context =
      conversation?.context &&
      typeof conversation?.context === "object" &&
      !Array.isArray(conversation.context)
        ? (conversation.context as Record<string, unknown>)
        : {};
    const proposalId = `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await this.prisma.whatsappConversation.update({
      where: { id: ctx.conversationId },
      data: {
        context: {
          ...context,
          activeSpecialist: "NEW_BOOKING",
          pendingBooking: { ...intent },
          pendingProposalId: proposalId,
          pendingProposalExpiresAt: new Date(
            Date.now() + PENDING_PROPOSAL_TTL_MS,
          ).toISOString(),
        } as object,
      },
    });

    return {
      ok: true,
      requiresConfirmation: true,
      proposalId,
      message:
        "Booking summary prepared. The customer must confirm in a separate message; the summary expires in 15 minutes.",
      summary: intent,
    };
  }

  private async resolveDefaultBranchId(): Promise<string> {
    const main = await this.prisma.branch.findFirst({
      where: { isMain: true, isActive: true },
      select: { id: true },
    });
    if (main) return main.id;
    const fallback = await this.prisma.branch.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!fallback) throw new Error("No active branch found");
    return fallback.id;
  }

  private async lookupClient(phone: string) {
    const client = await this.prisma.client.findFirst({
      where: { phone, deletedAt: null },
      select: { id: true, name: true },
    });
    return client
      ? { found: true, clientId: client.id, name: client.name }
      : { found: false };
  }

  private async listMyBookings(phone: string) {
    const client = await this.prisma.client.findFirst({
      where: { phone, deletedAt: null },
      select: { id: true },
    });
    if (!client) return { found: false, bookings: [] };
    const bookings = await this.prisma.booking.findMany({
      where: {
        clientId: client.id,
        scheduledAt: { gte: new Date() },
        status: { in: ["PENDING", "CONFIRMED", "AWAITING_PAYMENT"] },
      },
      orderBy: { scheduledAt: "asc" },
      take: 10,
      select: {
        id: true,
        scheduledAt: true,
        status: true,
      },
    });
    return { found: true, bookings };
  }

  private async cancelBookingRequest(
    phone: string,
    bookingId: string,
    reason?: string,
  ) {
    const client = await this.prisma.client.findFirst({
      where: { phone, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw new Error("No client found for this phone");

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, clientId: client.id },
    });
    if (!booking) throw new Error("Booking not found");

    await this.prisma.contactMessage.create({
      data: {
        name: "WhatsApp cancel request",
        phone,
        subject: `Cancel request — booking ${bookingId}`,
        body: `Customer requests to cancel booking ${bookingId}.\nReason: ${reason ?? "not provided"}`,
        status: "NEW",
      },
    });

    return {
      ok: true,
      message: "Cancellation request recorded. Staff will process shortly.",
    };
  }
}
