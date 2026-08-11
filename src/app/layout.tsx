import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { CookiesBanner } from "@/components/CookiesBanner";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://unira.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "TEYEVO — Viajes, Delivery, Envios y Pagos en Argentina | Cooperativa Unira",
  description: "TEYEVO es la super-app de transporte, delivery, envios y pagos de la Cooperativa Unira. Viajes seguros, comida a domicilio, envios express y billetera digital en Argentina.",
  applicationName: "TEYEVO",
  keywords: ["TEYEVO", "Unira", "ride", "delivery", "Argentina", "cooperativa", "viajes", "transporte", "billetera", "mudanza", "flete", "mascotas", "envios", "comida", "pagos", "cooperativa de trabajo"],
  authors: [{ name: "Cooperativa Unira" }],
  creator: "Cooperativa Unira",
  publisher: "Cooperativa Unira",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "TEYEVO",
    statusBarStyle: "black-translucent",
    startupImage: ["/icon-512.png"],
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon-32.png"],
  },
  openGraph: {
    title: "TEYEVO — Te llevamos lo que desees... donde lo desees",
    description: "Transporte, delivery, envios y pagos. Tu super-app cooperativa en Argentina.",
    type: "website",
    url: APP_URL,
    siteName: "TEYEVO",
    locale: "es_AR",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "TEYEVO - Super-app Cooperativa Unira" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TEYEVO",
    description: "Te llevamos lo que desees... donde lo desees. Super-app de transporte, delivery y pagos. Cooperativa Unira.",
    images: ["/icon-512.png"],
  },
  alternates: {
    canonical: APP_URL,
  },
  category: "transportation",
};

export const viewport: Viewport = {
  maximumScale: 1,
  userScalable: false,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0EA5A0" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0F14" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* PWA / Mobile meta tags (Next.js metadata covers most, but these need to be raw) */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TEYEVO" />
        <meta name="application-name" content="TEYEVO" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-TileColor" content="#0EA5A0" />
        <meta name="msapplication-tap-highlight" content="no" />
        {/* Safe area insets for notched devices */}
        <meta name="apple-touch-fullscreen" content="yes" />
      </head>
      <body
        className={`${jakarta.variable} antialiased bg-background text-foreground`}
        style={{ fontFamily: 'var(--font-jakarta), system-ui, sans-serif' }}
      >
        {children}
        <Toaster />
        <CookiesBanner />
      </body>
    </html>
  );
}
