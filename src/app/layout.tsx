import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The canonical public address, so shared links resolve their preview image.
const SITE_URL = "https://ai-native-dealdesk.vercel.app";

const DESCRIPTION =
  "Discount approvals that happen in Slack and email. A model reads the request, " +
  "a rule in code decides it, and nobody opens another dashboard.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Dealdesk · AI-Native Product Design",
    template: "%s · Dealdesk",
  },
  description: DESCRIPTION,
  openGraph: {
    title: "Dealdesk · AI-Native Product Design",
    description: DESCRIPTION,
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
