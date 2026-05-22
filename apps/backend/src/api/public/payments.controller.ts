import { Controller, Post, Body, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { OtpSessionGuard } from '../../modules/identity/otp/otp-session.guard';
import { InitGuestPaymentHandler } from '../../modules/finance/payments/public/init-guest-payment/init-guest-payment.handler';
import { InitGuestPaymentDto } from '../../modules/finance/payments/public/init-guest-payment/init-guest-payment.dto';
import type { OtpSessionPayload } from '../../modules/identity/otp/otp-session.service';

@ApiTags('Public / Payments')
@ApiPublicResponses()
@Controller('public/payments')
export class PublicPaymentsController {
  constructor(private readonly initGuestPayment: InitGuestPaymentHandler) {}

  @Public()
  @UseGuards(OtpSessionGuard)
  @Throttle({ default: { ttl: 60_000, limit: 1 } })
  @Post('init')
  @ApiOperation({ summary: 'Initialize a Moyasar payment for a guest booking (requires OTP session)' })
  async initPayment(
    @Body() dto: InitGuestPaymentDto,
    @Req() req: Request & { otpSession?: OtpSessionPayload },
  ) {
    // SECURITY (P0-9): OtpSessionGuard places the verified payload on req.otpSession.
    const session = req.otpSession;
    if (!session) throw new UnauthorizedException('OTP session missing');
    return this.initGuestPayment.execute({
      ...dto,
      otpIdentifier: session.identifier,
      otpJti: session.jti,
    });
  }
}
