import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { SessionProviderWrapper } from "@/components/SessionProviderWrapper";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  weight: ["500", "600"],
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rockncine",
  description: "Assista junto, em sync — link colado, sala compartilhada.",
  // O preview de link de convite é o funil do produto: o `InviteCode` copia a
  // URL da sala para mandar em conversa, e sem isto o preview vinha vazio. Só
  // título e descrição — os frames de vídeo do YouTube não podem ser
  // reaproveitados aqui, e uma imagem própria é trabalho de design que ainda
  // não existe.
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Rockncine",
    title: "Rockncine",
    description: "Assista junto, em sync — cole um link e todo mundo entra na mesma sala.",
  },
  twitter: {
    card: "summary",
    title: "Rockncine",
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
  themeColor: "#0f1a14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `suppressHydrationWarning`: o script abaixo escreve `data-js` no <html>
    // antes de o React hidratar, então o atributo difere do HTML do servidor. É
    // o escape documentado para o padrão de script de tema; sem ele o React
    // avisa a cada página em `next dev`.
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Marcador do realce progressivo.
            Roda antes do conteúdo do body pintar e só então o CSS esconde `.reveal`. Sem JS o
            atributo não existe, `.reveal` não casa nenhum seletor e o conteúdo nasce visível
            (AC-001). O `setTimeout` é a rede de segurança de FR-014: se o bundle não hidratar
            (chunk bloqueado, erro de rede, deploy skew), `data-hydrated` nunca é escrito e
            depois de 1,2s tudo é revelado — a animação nunca pode virar portão. É
            deliberadamente minúsculo e sem `src`. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.dataset.js='';setTimeout(function(){if(!document.documentElement.hasAttribute('data-hydrated'))document.documentElement.setAttribute('data-reveal','')},1200);",
          }}
        />
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
