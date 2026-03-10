import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://daily-doodle.vercel.app"),
  title: "Daily Doodle | Printable Coloring Pages",
  description: "Get fresh printable coloring pages every day. Download beautiful coloring sheets for adults and kids. No signup required.",
  keywords: ["coloring pages", "printable", "daily", "coloring sheets", "adult coloring", "kids coloring"],
  authors: [{ name: "Daily Doodle" }],
  openGraph: {
    title: "Daily Doodle | Printable Coloring Pages",
    description: "Fresh coloring pages delivered daily. Download beautiful printable sheets.",
    type: "website",
    locale: "en_US",
    images: [{
      url: "/og-image.png",
      width: 1200,
      height: 630,
      alt: "Daily Doodle - Printable Coloring Pages"
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Daily Doodle | Printable Coloring Pages",
    description: "Fresh coloring pages delivered daily. Download beautiful printable sheets.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://daily-doodle.vercel.app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Analytics />
        {children}
      </body>
    </html>
  );
}
