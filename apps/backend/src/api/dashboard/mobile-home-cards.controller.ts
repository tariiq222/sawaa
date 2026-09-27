import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CreateMobileHomeCardHandler } from '../../modules/org-experience/mobile-home-cards/create-mobile-home-card.handler';
import { ListMobileHomeCardsHandler } from '../../modules/org-experience/mobile-home-cards/list-mobile-home-cards.handler';
import { ReorderMobileHomeCardsHandler } from '../../modules/org-experience/mobile-home-cards/reorder-mobile-home-cards.handler';
import { UpdateMobileHomeCardHandler } from '../../modules/org-experience/mobile-home-cards/update-mobile-home-card.handler';
import { AdminMobileHomeCardDto } from '../../modules/org-experience/mobile-home-cards/mobile-home-card-response.dto';
import { CreateMobileHomeCardDto, ReorderMobileHomeCardsDto, UpdateMobileHomeCardDto } from '../../modules/org-experience/mobile-home-cards/mobile-home-cards.dto';

@ApiTags('Dashboard / Org Experience')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/mobile-home-cards')
export class DashboardMobileHomeCardsController {
  constructor(
    private readonly listCards: ListMobileHomeCardsHandler,
    private readonly createCard: CreateMobileHomeCardHandler,
    private readonly updateCard: UpdateMobileHomeCardHandler,
    private readonly reorderCards: ReorderMobileHomeCardsHandler,
  ) {}

  @Get()
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'List staff-managed mobile home cards' })
  @ApiOkResponse({ type: AdminMobileHomeCardDto, isArray: true })
  listEndpoint() {
    return this.listCards.execute();
  }

  @Post()
  @CheckPermissions({ action: 'update', subject: 'Setting' })
  @ApiOperation({ summary: 'Create a draft mobile home card' })
  @ApiCreatedResponse({ type: AdminMobileHomeCardDto })
  createEndpoint(@Body() body: CreateMobileHomeCardDto) {
    return this.createCard.execute(body);
  }

  @Patch(':id')
  @CheckPermissions({ action: 'update', subject: 'Setting' })
  @ApiOperation({ summary: 'Update a mobile home card with optimistic concurrency' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AdminMobileHomeCardDto })
  updateEndpoint(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateMobileHomeCardDto) {
    return this.updateCard.execute({ ...body, id });
  }

  @Put('reorder')
  @CheckPermissions({ action: 'update', subject: 'Setting' })
  @ApiOperation({ summary: 'Atomically reorder the full mobile home card list' })
  @ApiOkResponse({ type: AdminMobileHomeCardDto, isArray: true })
  reorderEndpoint(@Body() body: ReorderMobileHomeCardsDto) {
    return this.reorderCards.execute(body);
  }
}
