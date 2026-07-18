import { Injectable, NotFoundException } from '@nestjs/common';
import { auth } from '../auth.config';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationRateLimitService } from './verification-rate-limit.service';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: VerificationRateLimitService,
  ) {}

  async requestReset(
    email: string,
    redirectTo: string,
    headers: Headers,
  ): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('No account found with this email address');
    }

    await this.rateLimit.assertCanSendAuthEmail(user.id);

    await auth.api.requestPasswordReset({
      body: {
        email: user.email,
        redirectTo,
      },
      headers,
    });
  }
}
