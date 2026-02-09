import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { db } from './db';
import * as schema from './schema';

const baseURL = process.env.BETTER_AUTH_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
const isHttps = baseURL.startsWith('https://');

/**
 * Check if an origin is from a private/local network.
 * Allows sign-out and other auth operations from LAN IP addresses.
 */
function isPrivateOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.endsWith('.local')
    );
  } catch {
    return false;
  }
}

/**
 * Better Auth server configuration
 */
export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session age every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  advanced: {
    useSecureCookies: isHttps, // HTTP 환경에서는 Secure 쿠키 비활성화
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'user',
        input: false,
      },
    },
  },
  plugins: [
    admin({
      defaultRole: 'user',
      adminRole: 'admin',
    }),
  ],
  trustedOrigins: (request) => {
    const origins: (string | null | undefined)[] = [
      'http://localhost:5000',
      'http://localhost:3000',
      baseURL,
      process.env.NEXT_PUBLIC_APP_URL,
    ];

    // Also trust the origin from the current request if it's from a private network
    if (request) {
      const origin = request.headers.get('origin');
      if (origin && isPrivateOrigin(origin)) {
        origins.push(origin);
      }
    }

    return origins;
  },
});

export type Auth = typeof auth;

/**
 * Typed session including additionalFields (role, banned, etc.)
 * Better Auth's TypeScript inference doesn't include additionalFields automatically.
 */
export interface AuthSession {
  session: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    expiresAt: Date;
    token: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
  user: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    email: string;
    emailVerified: boolean;
    name: string;
    image?: string | null;
    role: string;
    banned?: boolean;
    banReason?: string | null;
    banExpires?: number | null;
  };
}

/**
 * Typed wrapper for auth.api.getSession
 * Returns session with role field properly typed.
 */
export async function getServerSession(reqHeaders: Headers): Promise<AuthSession | null> {
  return auth.api.getSession({ headers: reqHeaders }) as Promise<AuthSession | null>;
}
