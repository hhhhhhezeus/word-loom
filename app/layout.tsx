import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "拾词 Word Loom — 把偶遇的单词织成自己的语言",
  description: "自动还原单词原形，整理音标、词性、释义和例句的英语单词记忆 App。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "拾词 Word Loom",
    description: "把偶遇的单词，织成自己的语言。",
    type: "website",
    images: [{ url: "https://hhhhhhezeus.github.io/word-loom/og.png", width: 1730, height: 909, alt: "拾词学习图谱" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "拾词 Word Loom",
    description: "把偶遇的单词，织成自己的语言。",
    images: ["https://hhhhhhezeus.github.io/word-loom/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
