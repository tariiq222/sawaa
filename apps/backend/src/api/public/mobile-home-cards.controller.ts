import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiPublicResponses } from '../../common/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { GetPublicMobileHomeCardsHandler } from '../../modules/org-experience/mobile-home-cards/get-public-mobile-home-cards.handler';
import { PublicMobileHomeCardDto } from '../../modules/org-experience/mobile-home-cards/mobile-home-card-response.dto';

@ApiTags('Public / Catalog')
@ApiPublicResponses()
@Controller('public/mobile-home-cards')
export class PublicMobileHomeCardsController {
  constructor(private readonly getCards: GetPublicMobileHomeCardsHandler) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get()
  @ApiOperation({ summary: 'List published mobile home cards' })
  @ApiOkResponse({ type: PublicMobileHomeCardDto, isArray: true })
  listEndpoint() {
    return this.getCards.execute();
  }
}
