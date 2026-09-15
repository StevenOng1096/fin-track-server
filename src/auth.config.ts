import 'dotenv/config';
import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { getAllowedOrigins } from './common/utils/cors';
import { sendPasswordResetEmail } from './email/send-password-reset-email';
import { sendVerificationEmail } from './email/send-verification-email';
import { getPrismaClient } from './prisma/prisma-client';

const MOBILE_APP_SCHEME = process.env.MOBILE_APP_SCHEME ?? 'financetracker';

const CLIENT_DEVICE_HEADER = 'x-financetracker-client';

function getRequestHeaders(
  ctx: { headers?: Headers; request?: Request } | null | undefined,
): Headers | undefined {
  return ctx?.headers ?? ctx?.request?.headers;
}

function resolveSessionUserAgent(
  headers: Headers | undefined,
  fallback?: string | null,
): string | undefined {
  const fromClient = headers?.get(CLIENT_DEVICE_HEADER)?.trim();
  if (fromClient) {
    return fromClient;
  }
  const ua = headers?.get('user-agent')?.trim();
  return ua || fallback?.trim() || undefined;
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(getPrismaClient(), {
    provider: 'postgresql',
  }),
  plugins: [expo()],
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
    sendVerificationEmail: ({ user, url }) =>
      sendVerificationEmail(user.email, url).catch((error) => {
        console.error(
          `Failed to send verification email to ${user.email}:`,
          error instanceof Error ? error.message : error,
        );
      }),
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: ({ user, url }) =>
      sendPasswordResetEmail(user.email, url).catch((error) => {
        console.error(
          `Failed to send password reset email to ${user.email}:`,
          error instanceof Error ? error.message : error,
        );
      }),
  },
  trustedOrigins: [...getAllowedOrigins(), `${MOBILE_APP_SCHEME}://`],
  basePath: '/api/auth',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // extend expiry at most once per day
    // Better Auth applies freshAge to listSessions using createdAt (not updatedAt).
    // Match expiresIn so daily sliding refresh does not block the sessions page.
    freshAge: 60 * 60 * 24 * 7,
  },
  advanced: {
    useSecureCookies: true,
    defaultCookieAttributes: {
      sameSite: 'none',
      secure: true,
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: (session, ctx) => {
          const headers = getRequestHeaders(ctx);
          const userAgent = resolveSessionUserAgent(headers, session.userAgent);
          if (!userAgent || userAgent === session.userAgent) {
            return Promise.resolve({ data: session });
          }
          return Promise.resolve({
            data: {
              ...session,
              userAgent,
            },
          });
        },
      },
    },
  },
});
