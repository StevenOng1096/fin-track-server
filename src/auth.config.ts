import 'dotenv/config';
import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { getAllowedOrigins } from './common/utils/cors';
import { getPrismaClient } from './prisma/prisma-client';

const MOBILE_APP_SCHEME =
  process.env.MOBILE_APP_SCHEME ?? 'financetracker';

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
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  trustedOrigins: [
    ...getAllowedOrigins(),
    `${MOBILE_APP_SCHEME}://`,
  ],
  basePath: '/api/auth',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
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
        before: async (session, ctx) => {
          const headers = getRequestHeaders(ctx);
          const userAgent = resolveSessionUserAgent(headers, session.userAgent);
          if (!userAgent || userAgent === session.userAgent) {
            return { data: session };
          }
          return {
            data: {
              ...session,
              userAgent,
            },
          };
        },
      },
    },
  },
});
