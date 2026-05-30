import { Suspense } from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { ThemeProvider } from '@/theme';
import { QueryProvider } from '@/lib';
import { LoadingProvider } from '@/components/providers';
import './globals.css';

export { metadata, viewport } from './metadata';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div id="__next">
          <AppRouterCacheProvider>
            <ThemeProvider>
              <QueryProvider>
                <Suspense fallback={null}>
                  <LoadingProvider>{children}</LoadingProvider>
                </Suspense>
              </QueryProvider>
            </ThemeProvider>
          </AppRouterCacheProvider>
        </div>
      </body>
    </html>
  );
}
