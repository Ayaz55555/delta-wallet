import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import WagmiProvider from "@/components/WagmiProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { StructuredData } from "@/components/StructuredData";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Delta Wallet Markets",
  description:
    "Trade on outcomes with confidence. Decentralized prediction markets powered by blockchain technology.",
  keywords: [
    "prediction markets",
    "betting",
    "decentralized",
    "blockchain",
    "crypto",
    "trading",
  ],
  authors: [{ name: "Delta Wallet Team" }],
  creator: "Delta Wallet",
  publisher: "Delta Wallet",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_URL || "https://delta-wallet.vercel.app"
  ),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Delta Wallet Markets",
    description:
      "Trade on outcomes with confidence. Decentralized prediction markets powered by blockchain technology.",
    url: process.env.NEXT_PUBLIC_URL || "https://delta-wallet.vercel.app",
    siteName: "Delta Wallet",
    images: [
      {
        url: "/icon.jpg",
        width: 1200,
        height: 630,
        alt: "Delta Wallet Markets",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Delta Wallet Markets",
    description:
      "Trade on outcomes with confidence. Decentralized prediction markets powered by blockchain technology.",
    images: ["/icon.jpg"],
    creator: "@delta_wallet",
  },
  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <StructuredData metadata={metadata} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <WagmiProvider>
            {children}
            <Toaster />
          </WagmiProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
