# Research — identidade Kimi Platform

## Fonte da extração

- <https://platform.kimi.ai/pt-br?from=footer_nav>
- `/_next/static/css/8c39142f7033b9dd.css` (Tailwind e tokens shadcn)
- `/_next/static/css/bf93b1d8ab878e34.css` (tokens de produto da Kimi)
- `/_next/static/css/b4f64059cfc876ab.css` (home, nav, cards)

A extração foi feita no CSS público, sem executar o site. O REA não foi necessário.

## Tokens observados (dark)

| Papel | Valor |
|---|---|
| Canvas | `#121212` (`--Bg-Primary`) |
| Superfície | `#1f1f1f` (`--Bg-Secondary`) |
| Elevada | `#292929` (`--Bg-Tertiary`) |
| Controle | `#4d4d4d` (`--Bg-Quaternary`) |
| Texto primário | `#ffffffd6` (84%) |
| Texto secundário | `#ffffff8f` (56%) |
| Texto terciário | `#ffffff6b` (42%) |
| Separador | `#ffffff1f` (12%) |
| Fills | `#ffffff0d`, `#ffffff1a`, `#ffffff2e` |
| Scrim | `#0009` (60%) |
| Raio | `--radius: 0.625rem`; `xl: 0.75rem`; `2xl: 1rem` |
| Sombra | `0 4px 10px 0 #0000001a` |
| Nav | `bg 70%` + `backdrop-filter: blur(6px)` |
| Fontes | MiSans VF (sans), Geist Mono (mono) |
| Escala | 18/26, 16/24, 15/22, 14/20, 12/18, 10/14 |

## Decisões de adaptação

| Decisão | Racional |
|---|---|
| Geist + Geist Mono | Geist Mono é a mono da própria Kimi; Geist é o análogo livre mais próximo da MiSans, sem dependência npm (via `next/font/google`). |
| Paleta neutra | A pedido, nenhum acento cromático entra. A Kimi usa azul `#1a88ff`; o RockNCine mantém a regra herdada de estado sem matiz. |
| Glow ambiente em vez de vídeo | A hero da Kimi usa vídeo/imagens; o RockNCine usa um glow estático acromático para não adicionar asset nem peso. |
| Wordmark em gradiente | O gradiente prateado da hero da Kimi é acromático e substitui a arte ASCII. |
| Sem grão/ASCII | A textura fanzine é incompatível com a superfície limpa da referência. A spec 14 é substituída. |
| Blur no player | O chrome usa 6px; a barra de controles usa 12px sobre o vídeo. O guard de escopo ganha uma allowlist explícita. |
| Tema só dark | A referência foi o dark da Kimi Platform; um tema claro dobraria a superfície de teste. |

## O que foi descartado

- Azul de acento, verde/vermelho semânticos e qualquer matiz.
- Tema claro e seletor de tema.
- MiSans (fonte proprietária), logo e imagens da Kimi.
- Texturas de card, vídeo de fundo, parallax e animações coreografadas.
- Grão, ASCII e o papel display Space Mono da spec 14.
