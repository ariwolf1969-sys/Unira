import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Unira",
  description: "Tu super-app de transporte, delivery y más. Cooperativa de servicios urbanos.",
  keywords: ["Unira", "ride", "delivery", "Argentina", "cooperativa", "super-app"],
  authors: [{ name: "Unira" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Unira - Tu super-app",
    description: "Transporte, delivery y más. Todo en un solo lugar.",
    type: "website",
  },
};

export const viewport: Viewport = {
  maximumScale: 1,
  userScalable: false,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${jakarta.variable} antialiased bg-background text-foreground`}
        style={{ fontFamily: 'var(--font-jakarta), system-ui, sans-serif' }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
