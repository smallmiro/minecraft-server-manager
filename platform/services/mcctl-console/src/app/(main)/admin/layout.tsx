import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * Admin layout with server-side admin role check
 *
 * Since Next.js middleware runs in Edge runtime without database access,
 * we need to verify admin role in the layout using Node.js runtime.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Redirect if not authenticated or not admin
  if (!session || session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
