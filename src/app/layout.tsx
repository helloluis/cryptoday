import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CryptoDay News — AI-Powered Crypto News Aggregator & Sentiment Feed",
  description:
    "Real-time crypto news aggregated from 12+ top sources, analyzed by AI for sentiment and categorization. Free JSON feed available.",
  metadataBase: new URL("https://news.cryptoday.live"),
  openGraph: {
    title: "CryptoDay News",
    description: "AI-powered crypto news aggregation and sentiment analysis",
    type: "website",
  },
  other: {
    "talentapp:project_verification":
      "f274785523632eb0117ed0417e73433bdc2719d0d8b7bb109787e7f9c1c8687a034239105032e5dd3fe211666f9b9b7fea60ef57d39650e9ad7bca1af85d4170",
  },
};

export const viewport: Viewport = {
  themeColor: "#418260",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
