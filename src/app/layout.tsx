import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Sổ Chợ AI",
  description: "Sổ thu chi voice-first cho người bán nhỏ.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
