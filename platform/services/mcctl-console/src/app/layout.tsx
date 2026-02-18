import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Roboto_Mono } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { ThemeProvider } from '@/theme';
import { QueryProvider } from '@/lib';
import { LoadingProvider } from '@/components/providers';
import './globals.css';

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-roboto-mono',
});

export const metadata: Metadata = {
  title: 'Minecraft Server Manager',
  description: 'Web-based management console for Minecraft server infrastructure',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${robotoMono.variable} ${robotoMono.className}`}>
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
