import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Cabeçalhos de segurança.
//
// O app não tinha nenhum: a resposta saía com `X-Powered-By: Next.js` e sem
// uma única política de cabeçalho. O `next.config.ts` estava vazio.
//
// Cada header aqui tem uma razão específica para o app, não é uma lista
// genérica copiada de um template:
//
//   - `frame-ancestors 'none'`: o app não é embeddado por ninguém. Impede
//     clickjacking — a sala tem controles destrutivos (excluir sala) e o
//     `<form action="/rooms/new">` é POST nativo, então um frame de terceiro
//     mostrando nosso `/rooms` poderia capturar a criação de sala.
//   - `X-Content-Type-Options: nosniff`: a resposta de `/api/resolve-embed` e
//     do `/api/liveblocks-auth` é JSON/texto e nada ali deve ser interpretado
//     como HTML ou script.
//   - `Referrer-Policy: strict-origin-when-cross-origin`: o `GenericIframe`
//     já declara a mesma política no próprio iframe, mas o default do browser
//     só é esse desde 2020 — declarar aqui fixa o comportamento em qualquer
//     versão, e vale também para a navegação normal do app.
//   - `Permissions-Policy`: o app usa tela cheia e Picture-in-picture, e nada
//     além disso. Câmera, microfone, geolocalização e sensores desligados por
//     padrão: um embed de terceiro dentro da sala não tem por que ter acesso a
//     nada disso.
//
// A CSP fica de fora de propósito. A sala renderiza iframe de ARBITRÁRIO
// (`GENERIC_IFRAME` aceita qualquer http/https) e o player do YouTube roda
// script de `youtube.com`; uma `script-src` fechada quebraria o produto sem
// ganho mensurável aqui, porque o vetor de XSS já está fechado na origem — o
// `embedUrl` é validado por `isSafeEmbedUrl` no ponto de renderização, e todo
// payload de broadcast passa por `lib/chat-event.ts` e `lib/playback/events.ts`.
// Fechar o CSP aqui é trabalho que depende de inventariar as origens
// permitidas, e esse inventário não existe.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  ...(isDev
    ? []
    : [
        // HSTS só em produção: em `localhost` o browser ignora, mas em preview
        // da Vercel fixaria o domínio de preview em HTTPS por dois anos,
        // o que quebra a troca de branch nopreview seguinte.
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
];

const nextConfig: NextConfig = {
  // Não anuncia o framework. A versão é informação de ataque grátis.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
