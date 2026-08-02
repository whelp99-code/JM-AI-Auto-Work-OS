import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Work Automation OS v0.9.0",
  description: "Local-First AI 업무 자동화 운영체제"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
