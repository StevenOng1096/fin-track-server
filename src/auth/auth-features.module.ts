import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { EmailVerificationController } from './email-verification.controller';
import { EmailVerificationService } from './email-verification.service';
import { EmailVerifiedGuard } from './email-verified.guard';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';
import { VerificationRateLimitService } from './verification-rate-limit.service';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 3_600_000, limit: 10 }],
    }),
  ],
  controllers: [PasswordResetController, EmailVerificationController],
  providers: [
    PasswordResetService,
    EmailVerificationService,
    VerificationRateLimitService,
    {
      provide: APP_GUARD,
      useClass: EmailVerifiedGuard,
    },
  ],
})
export class AuthFeaturesModule {}
