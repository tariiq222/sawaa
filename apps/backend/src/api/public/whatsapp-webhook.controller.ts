// whatsapp-webhook.controller — receives inbound message events from Evolution API.
//
// Authentication: Evolution API's short-lived HS256 bearer JWT, signed with
// the per-instance jwt_key stored encrypted under WHATSAPP_PROVIDER_ENCRYPTION_KEY.

import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request } from "express";
import { Public } from "../../common/guards/jwt.guard";
import { WhatsappWebhookVerifier } from "../../modules/integrations/whatsapp/webhook/whatsapp-webhook-verifier";
import { WhatsappInboundQueueService } from "../../infrastructure/whatsapp/whatsapp-inbound-queue.service";

interface EvolutionMessageUpsertEvent {
  event: string;
  instance: string;
  data: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
      id?: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
    };
    messageType?: string;
    pushName?: string;
  };
}

@ApiTags("Public / WhatsApp Webhook")
@Controller("public/whatsapp")
export class WhatsappWebhookController {
  constructor(
    private readonly verifier: WhatsappWebhookVerifier,
    private readonly inboundQueue: WhatsappInboundQueueService,
  ) {}

  @Public()
  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Receive an authenticated Evolution API message webhook.",
  })
  @ApiBody({ type: Object })
  @ApiOkResponse({ schema: { type: "object", properties: { ok: { type: "boolean" } } } })
  @ApiBadRequestResponse({ description: "Missing raw body or invalid payload shape" })
  @ApiUnauthorizedResponse({
    description: "Signature verification failed or webhook secret not configured",
  })
  async handle(
    @Body() body: EvolutionMessageUpsertEvent,
    @Headers("authorization") authorization?: string,
    @Req() req?: Request,
  ): Promise<{ ok: true }> {
    const raw = (req as Request & { rawBody?: Buffer })?.rawBody?.toString("utf8") ?? "";
    await this.verifier.verify({
      rawBody: raw,
      authorization,
      payloadInstance: body?.instance,
    });

    // Acknowledge events we don't react to so Evolution stops retrying.
    if (body?.event !== "messages.upsert" && body?.event !== "MESSAGES_UPSERT") {
      return { ok: true };
    }

    const remoteJid = body?.data?.key?.remoteJid;
    const fromMe = body?.data?.key?.fromMe;
    const text =
      body?.data?.message?.conversation ??
      body?.data?.message?.extendedTextMessage?.text ??
      null;

    if (!remoteJid || fromMe || !text) {
      return { ok: true };
    }

    const phone = this.normalizePhoneFromJid(remoteJid);
    if (!phone) {
      return { ok: true };
    }

    await this.inboundQueue.enqueue({
      instance: body.instance,
      phone,
      text,
      externalMessageId: body.data.key?.id,
      rawBody: raw,
    });

    return { ok: true };
  }

  private normalizePhoneFromJid(jid: string): string | null {
    if (jid.endsWith("@g.us")) return null; // skip group messages
    const bare = jid.split("@")[0] ?? "";
    const numeric = bare.split(":")[0] ?? "";
    if (!numeric) return null;
    return `+${numeric}`;
  }
}
