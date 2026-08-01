import type { Metadata } from 'next';
import './globals.css';
import Script from 'next/script';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MobileNavbar from '@/components/MobileNavbar';
import MiniCart from '@/components/MiniCart';
import ToastContainer from '@/components/ToastContainer';
import AddToCartAnimation from '@/components/AddToCartAnimation';
import PageTransition from '@/components/PageTransition';
import SmoothScrollProvider from '@/components/SmoothScrollProvider';
import { ClerkProvider } from '@clerk/nextjs';
import { AuthSessionProvider } from '@/context/AuthContext';
import { DriftModeProvider } from '@/context/DriftModeContext';
import BfcacheHandler from '@/components/BfcacheHandler';

import { Outfit, Oxanium, Space_Mono } from 'next/font/google';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const oxanium = Oxanium({
  subsets: ['latin'],
  variable: '--font-oxanium',
  display: 'swap',
});

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
  display: 'swap',
});

const WhatsAppButton = dynamic(() => import('@/components/WhatsAppButton'), { ssr: false });
const SaleLiveBadge = dynamic(() => import('@/components/SaleLiveBadge'), { ssr: false });
const PushPrompt = dynamic(() => import('@/components/PushPrompt'), { ssr: false });
const NotificationToast = dynamic(() => import('@/components/NotificationToast'), { ssr: false });
const TopBanner = dynamic(() => import('@/components/TopBanner'), { ssr: false });
const DriftModePopup = dynamic(() => import('@/components/DriftModePopup'), { ssr: false });

export const metadata: Metadata = {
  title: {
    default: 'DRFTN CLOTHING | Premium Streetwear Brand Bengaluru',
    template: '%s | DRFTN CLOTHING',
  },
  description:
    'Born in Yelahanka, Bengaluru. Premium, imported streetwear and unisex fashion. Drift in style with our heavyweight tees, acid-wash hoodies, joggers, and techwear accessories.',
  keywords: [
    'streetwear',
    'DRFTN',
    'DRFTN clothing',
    'Bengaluru streetwear',
    'Indian streetwear',
    'unisex fashion',
    'oversized tees',
    'hoodies',
  ],
  authors: [{ name: 'DRFTN CLOTHING' }],
  metadataBase: new URL('https://www.drftnclothing.in'),
  openGraph: {
    title: 'DRFTN CLOTHING — Built Different',
    description: 'Born in Yelahanka, Bengaluru. Drift in style with premium imported streetwear.',
    url: 'https://www.drftnclothing.in',
    siteName: 'DRFTN CLOTHING',
    locale: 'en_IN',
    type: 'website',
    images: [
      {
        url: '/og-default.jpg',
        width: 1200,
        height: 630,
        alt: 'DRFTN CLOTHING — Built Different',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DRFTN CLOTHING — Built Different',
    description: 'Born in Yelahanka, Bengaluru. Drift in style with premium imported streetwear.',
    images: ['/og-default.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
          <link
            rel="stylesheet"
            id="silktide-consent-manager-css"
            href="https://cdn.jsdelivr.net/gh/silktide/consent-manager@v2.0.1/silktide-consent-manager.css"
            integrity="sha384-EdMq+R+YOnsbelo08wPenoTlnxbAyxI11NMIxzugx/qAsbh64KcOkqxYqq6pfvO/"
            crossOrigin="anonymous"
          />
          <style id="silktide-consent-manager-overrides">
            {`
              #stcm-wrapper {
                --boxShadow: -5px 5px 10px 0px #00000012, 0px 0px 50px 0px #0000001a;
                --fontFamily: Helvetica Neue, Segoe UI, Arial, sans-serif;
                --primaryColor: #FFFFFF;
                --backgroundColor: #070219;
                --textColor: #ffffff;
                --backdropBackgroundColor: #00000033;
                --backdropBackgroundBlur: 0px;
                --iconColor: #ffffff;
                --iconBackgroundColor: #070219;
              }
              #stcm-icon {
                display: none !important;
              }
            `}
          </style>
          <Script
            src="https://cdn.jsdelivr.net/gh/silktide/consent-manager@v2.0.1/silktide-consent-manager.js"
            integrity="sha384-5Pt34uiIbCsvfiiZXoLi4HRf/YBXjr9c8e+gYeVo9smUaInNHYVtc8NZ8wUnXJIq"
            crossOrigin="anonymous"
            strategy="lazyOnload"
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                document.addEventListener('DOMContentLoaded', function() {
                  if (window.silktideConsentManager) {
                    initSilktide();
                  } else {
                    var checkAttempts = 0;
                    var checkInterval = setInterval(function() {
                      checkAttempts++;
                      if (window.silktideConsentManager) {
                        clearInterval(checkInterval);
                        initSilktide();
                      } else if (checkAttempts > 100) {
                        clearInterval(checkInterval);
                      }
                    }, 50);
                  }
                });

                function initSilktide() {
                  window.silktideConsentManager.init({
                    backdrop: {
                      show: true
                    },
                    icon: {
                      position: "bottomLeft"
                    },
                    prompt: {
                      position: "bottomRight"
                    },
                    consentTypes: [
                      {
                        id: "essential",
                        label: "Essential",
                        description: "<p>These cookies are necessary for the website to function properly and cannot be switched off. They help with things like logging in and setting your privacy preferences.</p>",
                        required: true,
                        onAccept: function() {
                          console.log('Add logic for the required Essential consent type here');
                        }
                      },
                      {
                        id: "analytics",
                        label: "Analytics",
                        description: "<p>These cookies help us improve the site by tracking which pages are most popular and how visitors move around the site.</p>",
                        defaultValue: true,
                        gtag: "analytics_storage"
                      },
                      {
                        id: "marketing",
                        label: "Marketing",
                        description: "<p>These cookies are used by us and our advertising partners to show you relevant ads on this site and elsewhere, and to measure how those campaigns perform.</p>",
                        gtag: [
                          "ad_storage",
                          "ad_user_data",
                          "ad_personalization"
                        ]
                      }
                    ],
                    text: {
                      prompt: {
                        description: "<p>We use cookies on our site to enhance your user experience, provide personalized content, and analyze our traffic.</p>",
                        acceptAllButtonText: "Accept all",
                        acceptAllButtonAccessibleLabel: "Accept all cookies",
                        rejectNonEssentialButtonText: "Reject non-essential",
                        rejectNonEssentialButtonAccessibleLabel: "Reject all non-essential cookies",
                        preferencesButtonText: "Preferences",
                        preferencesButtonAccessibleLabel: "Toggle preferences"
                      },
                      preferences: {
                        title: "Customize your cookie preferences",
                        description: "<p>We respect your right to privacy. You can choose not to allow some types of cookies. Your cookie preferences will apply across our website.</p>",
                        saveButtonText: "Save and close",
                        saveButtonAccessibleLabel: "Save your cookie preferences",
                        creditLinkText: "Get this banner for free",
                        creditLinkAccessibleLabel: "Get this banner for free"
                      }
                    }
                  });
                }
              `
            }}
          />
          {/* LCP Image High-Priority Speculative Preload (Mobile: 38KB WebP, Desktop: 129KB WebP) */}
          <link rel="preload" href="/mobilewhite.webp" as="image" type="image/webp" fetchPriority="high" media="(max-width: 767px)" />
          <link rel="preload" href="/hero/hoodie-light.webp" as="image" type="image/webp" fetchPriority="high" media="(min-width: 768px)" />
        </head>
        <body suppressHydrationWarning className={`${outfit.variable} ${oxanium.variable} ${spaceMono.variable} antialiased min-h-screen flex flex-col bg-brand-black text-brand-offwhite p-0 m-0`}>
          <SmoothScrollProvider>
            <AuthSessionProvider>
              <DriftModeProvider>
                {/* Global Navbar */}
                <Navbar />

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col relative w-full p-0 m-0">
                  <PageTransition>{children}</PageTransition>
                </main>

                {/* Global Footer */}
                <Footer />

                {/* Drift Mode Popup */}
                <DriftModePopup />

                {/* Global Navigation Drawers and Widgets */}
                <MiniCart />
                <MobileNavbar />
                <WhatsAppButton />
                <SaleLiveBadge />
                <ToastContainer />
                <AddToCartAnimation />
                <PushPrompt />
                <BfcacheHandler />
                <NotificationToast />
                {/* Clerk Smart CAPTCHA anchor — must exist in DOM for Turnstile to mount */}
                <div id="clerk-captcha" />
              </DriftModeProvider>
            </AuthSessionProvider>
          </SmoothScrollProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
