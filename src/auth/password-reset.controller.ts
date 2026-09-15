import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { PasswordResetService } from './password-reset.service';

@Controller('password-reset')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @AllowAnonymous()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post('request')
  async request(@Body() dto: RequestPasswordResetDto, @Req() request: Request) {
    await this.passwordResetService.requestReset(
      dto.email,
      dto.redirectTo,
      request.headers as unknown as Headers,
    );

    return { message: 'Password reset email sent' };
  }
}
