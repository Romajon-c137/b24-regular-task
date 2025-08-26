import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Regular Tasks MVP",
  description: "Лёгкий фронт для регулярных задач (Bitrix-подобный)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
