import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rush Hour — Voice Operations Lab",
  description:
    "Speak an order, correct it, and inspect every change. Built with Sarvam.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
