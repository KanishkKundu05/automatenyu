import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NYU - ASCII Animation",
  description: "NYU torch ASCII art animation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
