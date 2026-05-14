import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { CreateContactMessageHandler } from '../../modules/comms/contact-messages/create-contact-message.handler';
import { CreateContactMessageDto } from '../../modules/comms/contact-messages/create-contact-message.dto';

@ApiTags('Public / Contact')
@ApiPublicResponses()
@Controller('public/contact-messages')
export class PublicContactMessagesController {
  constructor(private readonly handler: CreateContactMessageHandler) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Submit contact message' })
  @ApiCreatedResponse({ description: 'Message accepted' })
  submit(@Body() dto: CreateContactMessageDto) {
    return this.handler.execute(dto);
  }
}
