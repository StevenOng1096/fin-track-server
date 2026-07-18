import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { auth } from '../auth.config';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationRateLimitService } from './verification-rate-limit.service';

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: VerificationRateLimitService,
  ) {}

  async resend(email: string, callbackURL: string, headers: Headers): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!user) {
      throw new NotFoundException('No account found with this email address');
    }

    if (user.emailVerified) {
      throw new BadRequestException('This email address is already verified');
    }

    await this.rateLimit.assertCanSendAuthEmail(user.id);

    await auth.api.sendVerificationEmail({
      body: {
        email: user.email,
        callbackURL,
      },
      headers,
    });

    await this.rateLimit.recordVerificationEmailSent(user.id);
  }
}
