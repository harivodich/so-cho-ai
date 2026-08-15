import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";

import "./globals.css";
import "./ui-accessibility.css";
import "./monthly-dashboard.css";
import "./report-workspace.css";
import "./growth.css";
import "./daily-insight.css";
import "./report-tools.css";
import "./evaluation-lab.css";

const beVietnamPro = Be_Vietnam_Pro({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-be-vietnam-pro",
});

export const metadata: Metadata = {
  title: "Sổ Chợ AI",
  description: "Sổ thu chi voice-first cho người bán nhỏ.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <body className={beVietnamPro.className}>{children}</body>
    </html>
  );
}
