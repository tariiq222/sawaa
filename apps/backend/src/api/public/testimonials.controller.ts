import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { ListPublicTestimonialsHandler } from '../../modules/org-experience/ratings/list-public-testimonials.handler';
import { ListPublicTestimonialsDto } from '../../modules/org-experience/ratings/list-public-testimonials.dto';
import { PublicTestimonialResponseDto } from './testimonial-response.dto';

@ApiTags('Public / Testimonials')
@ApiPublicResponses()
@Controller('public/testimonials')
export class PublicTestimonialsController {
  constructor(private readonly listTestimonials: ListPublicTestimonialsHandler) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get()
  @ApiOperation({ summary: 'List public testimonials (anonymized ratings)' })
  @ApiOkResponse({ type: [PublicTestimonialResponseDto], description: 'Array of public testimonials' })
  list(@Query() query: ListPublicTestimonialsDto): Promise<PublicTestimonialResponseDto[]> {
    return this.listTestimonials.execute(query);
  }
}
