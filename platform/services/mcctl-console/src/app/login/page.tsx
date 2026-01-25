import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

/**
 * Login page component
 *
 * Wraps LoginForm in Suspense boundary for useSearchParams compatibility.
 * @see https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

/**
 * Loading skeleton for login page
 */
function LoginPageSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-muted" />
          <div className="mt-6 mx-auto h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="mt-2 mx-auto h-4 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
            </div>
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
