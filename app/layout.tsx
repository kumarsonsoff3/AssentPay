import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./dashboard-preview.css";
import "./landing-sections.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AssentPay — Turn client conversations into real payments",
  description:
    "Meet the AI financial operations agent that turns business conversations into invoices, payment requests, and follow-ups—with your approval at every step.",
  applicationName: "AssentPay",
  openGraph: {
    title: "AssentPay — Turn client conversations into real payments",
    description: "An AI financial operations agent that connects conversations, agreements, and payments—with your approval at every step. Explore the product preview.",
    type: "website",
    locale: "en_US",
    siteName: "AssentPay",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
