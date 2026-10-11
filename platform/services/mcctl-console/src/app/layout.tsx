import { Suspense } from 'react';
import { unstable_noStore as noStore } from 'next/cache';
import Script from 'next/script';
import { Config } from '@minecraft-docker/shared/utils';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { ThemeProvider } from '@/theme';
import { QueryProvider } from '@/lib';
import { LoadingProvider } from '@/components/providers';
import { AnalyticsTracker } from '@/components/analytics/AnalyticsTracker';
import { GA_MEASUREMENT_ID, getAnalyticsSettings } from '@/lib/analytics';
import { ANALYTICS_BASE } from '@/lib/analytics-path';
import './globals.css';

export { metadata, viewport } from './metadata';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  noStore(); // read .mcctl.json per request, never bake build-machine values
  const analytics = getAnalyticsSettings(process.env, new Config());
  return (
    <html lang="en">
      <body>
        {analytics && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            {/* beforeInteractive: config must be queued before AnalyticsTracker's first page_view.
                The real (normalized) path is set by AnalyticsTracker; this is only a safe placeholder. */}
            <Script id="ga-init" strategy="beforeInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());
gtag('set',{page_location:${JSON.stringify(ANALYTICS_BASE + '/')},page_referrer:${JSON.stringify(ANALYTICS_BASE + '/')}});
gtag('config',${JSON.stringify(GA_MEASUREMENT_ID)},{user_id:${JSON.stringify(analytics.installId)},send_page_view:false,user_properties:{mcctl_version:${JSON.stringify(analytics.version)}}});`}
            </Script>
            <AnalyticsTracker />
          </>
        )}
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
