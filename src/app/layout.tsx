import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import CookieBanner from '@/components/CookieBanner'

export const metadata: Metadata = {
  title: "LexJuridica Premium",
  description: "Plateforme SaaS de révision juridique avec IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <head>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5470304040691258"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#0f0f11] text-[#e8e8ee]">
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
