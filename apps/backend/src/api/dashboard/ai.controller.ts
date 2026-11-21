import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Request,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiExtraModels,
  ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse, ApiResponse, ApiProperty,
} from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';
import { ApiErrorDto, ApiStandardResponses } from '../../common/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { ManageKnowledgeBaseHandler } from '../../modules/ai/manage-knowledge-base/manage-knowledge-base.handler';
import {
  ListDocumentsDto,
  CreateDocumentDto,
  UpdateDocumentDto,
} from '../../modules/ai/manage-knowledge-base/manage-knowledge-base.dto';
import { ChatCompletionHandler } from '../../modules/ai/chat-completion/chat-completion.handler';
import { ChatCompletionDto } from '../../modules/ai/chat-completion/chat-completion.dto';
import { GetChatbotConfigHandler } from '../../modules/ai/chatbot-config/get-chatbot-config.handler';
import { UpsertChatbotConfigHandler } from '../../modules/ai/chatbot-config/upsert-chatbot-config.handler';
import { UpsertChatbotConfigDto } from '../../modules/ai/chatbot-config/upsert-chatbot-config.dto';
import { GetAiProviderConfigHandler } from '../../modules/ai/provider-config/get-ai-provider-config.handler';
import { UpsertAiProviderConfigHandler } from '../../modules/ai/provider-config/upsert-ai-provider-config.handler';
import { TestAiProviderConfigHandler } from '../../modules/ai/provider-config/test-ai-provider-config.handler';
import { UpsertAiProviderConfigDto, TestAiProviderConfigDto, AiProviderConfigResponseDto, AiProviderTestResponseDto, AiProviderModelSuggestionDto } from '../../modules/ai/provider-config/provider-config.dto';
import { AiProvider, DEFAULT_OPENROUTER_MODEL } from '../../infrastructure/ai/ai-provider-config.types';
import { AiChatCompletionResponseDto } from './dto/ai-response.dto';

class KnowledgeDocumentSummaryResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Document UUID.', example: '00000000-0000-4000-a000-000000000050' }) id!: string;
  @ApiProperty({ description: 'Document title.', example: 'Clinic FAQ' }) title!: string;
  @ApiProperty({ enum: ['manual', 'url'], description: 'Document source: manually authored text, or a page fetched from sourceRef.', example: 'manual' }) sourceType!: string;
  @ApiProperty({ nullable: true, description: 'Document source reference: an HTTPS URL for `url` entries, otherwise null.', example: 'https://example.com/faq' }) sourceRef!: string | null;
  @ApiProperty({ enum: DocumentStatus, example: DocumentStatus.PENDING, description: 'Indexing status; reset to PENDING whenever content or source changes.' }) status!: DocumentStatus;
  @ApiProperty({ description: 'Whether the document is available to the assistant.', example: false }) isPublished!: boolean;
  @ApiProperty({ nullable: true, format: 'date-time', description: 'Publication instant, or null while the document is unpublished.', example: '2026-03-01T10:00:00.000Z' }) publishedAt!: string | null;
  @ApiProperty({ nullable: true, format: 'date-time', description: 'When indexing last completed successfully, or null if the current content was never indexed.', example: '2026-03-01T10:00:00.000Z' }) lastIndexedAt!: string | null;
  @ApiProperty({ nullable: true, description: 'Machine-readable code from the last failed indexing attempt, or null.', example: 'CONTENT_MISSING' }) lastIndexErrorCode!: string | null;
  @ApiProperty({ nullable: true, description: 'Free-form JSON metadata supplied with the document.', example: { source: 'admin' } }) metadata!: Record<string, unknown> | null;
  @ApiProperty({ format: 'date-time', description: 'Creation instant.', example: '2026-03-01T10:00:00.000Z' }) createdAt!: string;
  @ApiProperty({ format: 'date-time', description: 'Last update instant.', example: '2026-03-01T10:00:00.000Z' }) updatedAt!: string;
}

class KnowledgeDocumentDetailResponseDto extends KnowledgeDocumentSummaryResponseDto {
  @ApiProperty({ nullable: true, maxLength: 50_000, description: 'Plain-text document body, or null when the document holds no stored text.', example: 'Clinic opening hours are Sunday to Thursday, 09:00 to 17:00.' }) content!: string | null;
  @ApiProperty({
    type: 'array',
    items: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, chunkIndex: { type: 'number' }, tokenCount: { type: 'number' } } },
    description: 'Indexed chunks of the current content, ordered by chunkIndex.',
    example: [{ id: '00000000-0000-4000-a000-000000000051', chunkIndex: 0, tokenCount: 128 }],
  })
  chunks!: Array<{ id: string; chunkIndex: number; tokenCount: number }>;
}

class KnowledgeDocumentPageResponseDto {
  @ApiProperty({ type: KnowledgeDocumentSummaryResponseDto, isArray: true, description: 'Documents on this page, newest first.', example: [] }) data!: KnowledgeDocumentSummaryResponseDto[];
  @ApiProperty({ type: 'object', properties: { total: { type: 'number' }, page: { type: 'number' }, limit: { type: 'number' }, totalPages: { type: 'number' } }, required: ['total', 'page', 'limit', 'totalPages'], description: 'Pagination metadata for the full result set.', example: { total: 1, page: 1, limit: 20, totalPages: 1 } }) meta!: { total: number; page: number; limit: number; totalPages: number };
}

class KnowledgeReindexResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Document UUID queued for reindexing.', example: '00000000-0000-4000-a000-000000000050' }) documentId!: string;
  @ApiProperty({ description: 'SHA-256 hex digest of the document content being indexed.', example: '0000000000000000000000000000000000000000000000000000000000000000' }) contentHash!: string;
  @ApiProperty({ nullable: true, format: 'uuid', description: 'Outbox event UUID for the reindex request, or null when no new event was created.', example: '00000000-0000-4000-a000-000000000052' }) eventId!: string | null;
  @ApiProperty({ enum: ['PENDING'], example: 'PENDING' }) status!: 'PENDING';
}

@ApiTags('Dashboard / AI')
@ApiExtraModels(CreateDocumentDto, UpdateDocumentDto, KnowledgeDocumentSummaryResponseDto, KnowledgeDocumentDetailResponseDto, KnowledgeDocumentPageResponseDto, KnowledgeReindexResponseDto)
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('dashboard/ai')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardAiController {
  constructor(
    private readonly knowledgeBase: ManageKnowledgeBaseHandler,
    private readonly chatCompletion: ChatCompletionHandler,
    private readonly getChatbotConfig: GetChatbotConfigHandler,
    private readonly upsertChatbotConfig: UpsertChatbotConfigHandler,
    private readonly getAiProviderConfig: GetAiProviderConfigHandler,
    private readonly upsertAiProviderConfig: UpsertAiProviderConfigHandler,
    private readonly testAiProviderConfig: TestAiProviderConfigHandler,
  ) {}

  // ── Knowledge Base ─────────────────────────────────────────────────────────
  @Get('knowledge-base')
  @ApiOperation({ summary: 'List knowledge-base documents' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by document status', enum: DocumentStatus, example: DocumentStatus.PENDING })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 20 })
  @ApiOkResponse({ description: 'Paginated list of knowledge-base documents', type: KnowledgeDocumentPageResponseDto })
  @CheckPermissions({ action: 'read', subject: 'Content' })
  listDocuments(@Query() query: ListDocumentsDto) {
    return this.knowledgeBase.listDocuments(query);
  }

  @Post('knowledge-base')
  @HttpCode(HttpStatus.CREATED)
  @CheckPermissions({ action: 'manage', subject: 'Content' })
  @ApiOperation({ summary: 'Create a knowledge-base document' })
  @ApiCreatedResponse({ description: 'Created knowledge-base document', type: KnowledgeDocumentSummaryResponseDto })
  createDocument(
    @Body() body: CreateDocumentDto,
    @Request() req: { user?: { id?: string; email?: string } },
  ) {
    return this.knowledgeBase.createDocument({ ...body, actor: req.user });
  }

  // ── Sawaa AI provider ──────────────────────────────────────────────────────
  @Get('provider-config')
  @CheckPermissions({ action: 'read', subject: 'ProviderConfig' })
  @ApiOperation({ summary: 'Get the safe AI provider configuration projection' })
  @ApiOkResponse({ type: AiProviderConfigResponseDto })
  getAiProviderConfigEndpoint() { return this.getAiProviderConfig.execute(); }

  @Put('provider-config')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'ProviderConfig' })
  @ApiOperation({ summary: 'Update AI provider settings without accepting a credential' })
  @ApiOkResponse({ type: AiProviderConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Enablement requires a matching successful test' })
  upsertAiProviderConfigEndpoint(@Body() body: UpsertAiProviderConfigDto, @Request() req: { user?: { id?: string; email?: string } }) {
    return this.upsertAiProviderConfig.execute(body, req.user);
  }

  @Post('provider-config/test')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'ProviderConfig' })
  @ApiOperation({ summary: 'Test a write-only candidate AI provider credential' })
  @ApiOkResponse({ type: AiProviderTestResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid provider candidate or model' })
  testAiProviderConfigEndpoint(@Body() body: TestAiProviderConfigDto, @Request() req: { user?: { id?: string; email?: string } }) {
    return this.testAiProviderConfig.execute(body, req.user);
  }

  @Get('provider-config/models')
  @CheckPermissions({ action: 'read', subject: 'ProviderConfig' })
  @ApiOperation({ summary: 'List safe curated AI provider model suggestions' })
  @ApiOkResponse({ type: AiProviderModelSuggestionDto, isArray: true })
  getAiProviderModels() {
    return [
      { provider: AiProvider.OPENROUTER, models: [DEFAULT_OPENROUTER_MODEL], allowCustom: false },
    ];
  }
  @CheckPermissions({ action: 'read', subject: 'Content' })
  @Get('knowledge-base/:id')
  @ApiOperation({ summary: 'Get a knowledge-base document by ID' })
  @ApiParam({ name: 'id', description: 'Document UUID', example: '00000000-0000-0000-0000-000000000001' })
  @ApiOkResponse({ description: 'Document detail', type: KnowledgeDocumentDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Document not found' })
  getDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.knowledgeBase.getDocument({ documentId: id });
  }

  @Post('knowledge-base/:id/publish')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'Content' })
  @ApiOperation({ summary: 'Publish a knowledge-base document' })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiOkResponse({ description: 'Published document', type: KnowledgeDocumentSummaryResponseDto })
  publishDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user?: { id?: string; email?: string } },
  ) {
    return this.knowledgeBase.publishDocument({ documentId: id, actor: req.user });
  }

  @Post('knowledge-base/:id/unpublish')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'Content' })
  @ApiOperation({ summary: 'Unpublish a knowledge-base document' })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiOkResponse({ description: 'Unpublished document', type: KnowledgeDocumentSummaryResponseDto })
  unpublishDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user?: { id?: string; email?: string } },
  ) {
    return this.knowledgeBase.unpublishDocument({ documentId: id, actor: req.user });
  }

  @Post('knowledge-base/:id/reindex')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'Content' })
  @ApiOperation({ summary: 'Request knowledge-base document reindexing' })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiOkResponse({ description: 'Reindex request accepted', type: KnowledgeReindexResponseDto })
  reindexDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user?: { id?: string; email?: string } },
  ) {
    return this.knowledgeBase.reindexDocument({ documentId: id, actor: req.user });
  }
  @CheckPermissions({ action: 'manage', subject: 'Content' })
  @Patch('knowledge-base/:id')
  @ApiOperation({ summary: 'Update a knowledge-base document' })
  @ApiParam({ name: 'id', description: 'Document UUID', example: '00000000-0000-0000-0000-000000000001' })
  @ApiOkResponse({ description: 'Updated document', schema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, title: { type: 'string' }, status: { type: 'string' }, updatedAt: { type: 'string', format: 'date-time' } } } })
  @ApiResponse({ status: 404, description: 'Document not found' })
  updateDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDocumentDto,
    @Request() req: { user?: { id?: string; email?: string } },
  ) {
    return this.knowledgeBase.updateDocument({ documentId: id, ...body, actor: req.user });
  }
  @CheckPermissions({ action: 'manage', subject: 'Content' })
  @Delete('knowledge-base/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a knowledge-base document' })
  @ApiParam({ name: 'id', description: 'Document UUID', example: '00000000-0000-0000-0000-000000000001' })
  @ApiNoContentResponse({ description: 'Document deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  deleteDocument(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user?: { id?: string; email?: string } }) {
    return this.knowledgeBase.deleteDocument({ documentId: id, actor: req.user });
  }

  // ── Chatbot Config ────────────────────────────────────────────────────────
  @Get('chatbot-config')
  @ApiOperation({ summary: 'Get chatbot configuration (org-unique singleton)' })
  @ApiOkResponse({
    description: 'Chatbot configuration for the current org (created on first read)',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        isEnabled: { type: 'boolean' },
        welcomeMessage: { type: 'string', nullable: true },
        model: { type: 'string', nullable: true },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @CheckPermissions({ action: 'read', subject: 'Content' })
  getChatbotConfigEndpoint() {
    return this.getChatbotConfig.execute();
  }
  @CheckPermissions({ action: 'manage', subject: 'Content' })
  @Patch('chatbot-config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert chatbot configuration (org-unique singleton)' })
  @ApiOkResponse({ description: 'Updated chatbot configuration', schema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, isEnabled: { type: 'boolean' }, welcomeMessage: { type: 'string', nullable: true }, model: { type: 'string', nullable: true }, updatedAt: { type: 'string', format: 'date-time' } } } })
  upsertChatbotConfigEndpoint(@Body() body: UpsertChatbotConfigDto) {
    return this.upsertChatbotConfig.execute(body);
  }

  // ── Chat Completion ────────────────────────────────────────────────────────
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a chat message and receive an AI reply' })
  @ApiOkResponse({ type: AiChatCompletionResponseDto, description: 'AI reply with session ID and sources count' })
  @ApiResponse({ status: 503, description: 'The AI provider is unavailable; retry later', type: ApiErrorDto })
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  chatCompletionEndpoint(
    @Body() body: ChatCompletionDto,
    @Request() req: { user?: { id?: string } },
  ): Promise<AiChatCompletionResponseDto> {
    // SECURITY (P0-4): caller identity is injected from the JWT, never from body.
    return this.chatCompletion.execute({
      userMessage: body.userMessage,
      sessionId: body.sessionId,
      userId: req.user?.id,
    });
  }
}
