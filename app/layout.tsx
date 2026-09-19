import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProviderWrapper } from "@/components/SessionProviderWrapper";

// Inter é o fallback do `--font-sans` (ver globals.css): a fonte que aparece é a
// do sistema quando ele tem SF Pro, e esta quando não tem. Geist saiu — era
// webfont paga em bytes em toda plataforma, inclusive nas que já têm a fonte
// certa.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "rockncine",
  description: "Assista junto, em sync — link colado, sala compartilhada.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
