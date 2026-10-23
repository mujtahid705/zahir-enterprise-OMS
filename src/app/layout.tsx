import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ZE Order & Billing",
    template: "%s · ZE Order & Billing",
  },
  description: "Order & Billing System for Zahir Enterprise",
  applicationName: "ZE Order & Billing",
  appleWebApp: { title: "ZE", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#081F3F",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
