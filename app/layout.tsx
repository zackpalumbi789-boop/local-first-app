import type { Metadata } from "next";
import { Instrument_Serif, Outfit } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "智能菜谱 AI — 输入菜名，AI 帮你做",
  description:
    "利用大语言模型生成结构化、步骤清晰、图文并茂的智能菜谱，支持对话式微调配方",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN"
      className={`${instrumentSerif.variable} ${outfit.variable}`}
      style={{ colorScheme: "light" }}
    >
      <body>{children}</body>
    </html>
  );
}
