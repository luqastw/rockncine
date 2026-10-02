import type { Metadata, Viewport } from "next";
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
  // O preview de link de convite é o funil do produto: o `InviteCode` copia a
  // URL da sala para mandar em conversa, e sem isto o preview vinha vazio. Só
  // título e descrição — os frames de vídeo do YouTube não podem ser
  // reaproveitados aqui, e uma imagem própria é trabalho de design que ainda
  // não existe.
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "rockncine",
    title: "rockncine",
    description: "Assista junto, em sync — cole um link e todo mundo entra na mesma sala.",
  },
  twitter: {
    card: "summary",
    title: "rockncine",
    description: "Assista junto, em sync — cole um link e todo mundo entra na mesma sala.",
  },
  robots: { index: false, follow: false },
};

// `viewport` é um export separado de `metadata` nesta versão do Next (ver
// `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md`).
//
// `themeColor` é o que pinta a barra do navegador no Android. Sem ele, a barra
// fica clara por padrão sobre um app inteiramente escuro — a faixa mais visível
// do produto em celular, e a primeira coisa que aparece ao abrir um link de
// convite.
//
// `viewportFit: "cover"` + `viewport-fit=cover` no CSS: o `pb-14` que a sala
// reserva para o badge do Liveblocks é o que segura a folga inferior, então o
// app não precisa de `safe-area-inset` para o teclado virtual e a barra de
// gestos não overlays o composer.
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
