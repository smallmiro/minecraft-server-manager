import { useQuery } from '@tanstack/react-query';
import { adminClient } from '@/lib/auth-client';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  banned: boolean;
  createdAt: Date;
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async (): Promise<User[]> => {
      const { data, error } = await adminClient.listUsers({ query: {} });

      if (error) {
        throw new Error(error.message || 'Failed to fetch users');
      }

      if (!data?.users) {
        return [];
      }

      // Map Better Auth user type to our User interface
      return data.users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        role: user.role ?? 'user',
        banned: user.banned ?? false,
        createdAt: new Date(user.createdAt),
      }));
    },
  });
}
