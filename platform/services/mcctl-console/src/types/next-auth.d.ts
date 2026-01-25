import 'next-auth';
import 'next-auth/jwt';

/**
 * NextAuth.js type extensions for custom user properties
 *
 * @see https://next-auth.js.org/getting-started/typescript
 */
declare module 'next-auth' {
  interface User {
    id: string;
    username: string;
    role: 'admin' | 'user';
  }

  interface Session {
    user: {
      id: string;
      username: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: 'admin' | 'user';
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    username: string;
    role: 'admin' | 'user';
  }
}
