import { NextAuthOptions, User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

/**
 * Extended user type with role information
 */
export interface AuthUser extends User {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

/**
 * NextAuth.js configuration
 *
 * Uses Credentials Provider for username/password authentication.
 * In production, this should authenticate against mcctl-api.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: {
          label: 'Username',
          type: 'text',
          placeholder: 'admin',
        },
        password: {
          label: 'Password',
          type: 'password',
        },
      },
      async authorize(credentials): Promise<AuthUser | null> {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        // TODO: Replace with actual mcctl-api authentication
        // This is a mock implementation for development
        const apiUrl = process.env.MCCTL_API_URL || 'http://localhost:3001';

        try {
          // Mock authentication for development (until mcctl-api auth is ready)
          // In production, this should call: POST ${apiUrl}/api/auth/login
          if (
            credentials.username === 'admin' &&
            credentials.password === 'admin'
          ) {
            return {
              id: '1',
              username: credentials.username,
              name: 'Administrator',
              email: 'admin@localhost',
              role: 'admin',
            };
          }

          // Attempt API authentication (when mcctl-api is available)
          const response = await fetch(`${apiUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
            }),
          });

          if (response.ok) {
            const user = await response.json();
            return {
              id: user.id,
              username: user.username,
              name: user.name || user.username,
              email: user.email,
              role: user.role || 'user',
            };
          }

          return null;
        } catch {
          // API not available, use mock auth for development
          if (
            credentials.username === 'admin' &&
            credentials.password === 'admin'
          ) {
            return {
              id: '1',
              username: credentials.username,
              name: 'Administrator',
              email: 'admin@localhost',
              role: 'admin',
            };
          }
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as AuthUser;
        token.id = authUser.id;
        token.username = authUser.username;
        token.role = authUser.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as 'admin' | 'user';
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV === 'development',
};
