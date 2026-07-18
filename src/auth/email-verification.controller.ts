import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { EmailVerificationService } from './email-verification.service';

@Controller('email-verification')
export class EmailVerificationController {
  constructor(
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @AllowAnonymous()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post('resend')
  async resend(@Body() dto: ResendVerificationDto, @Req() request: Request) {
    await this.emailVerificationService.resend(
      dto.email,
      dto.callbackURL,
      request.headers as unknown as Headers,
    );

    return { message: 'Verification email sent' };
  }
}
