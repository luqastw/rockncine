# RockNCine — specs

Site estilo Rave: link de vídeo colado numa sala (YouTube como caso principal com sync completo;
Vimeo e embeds genéricos como fontes adicionais), player sincronizado entre participantes onde a
fonte permite, chat ao vivo.

Cada pasta abaixo é uma spec por unidade de trabalho, na ordem em que foi escrita. O que antes vivia
num único `SPEC.md` na raiz do repo foi fatiado aqui em 2026-08-21 — o arquivo antigo virou um stub
de redirecionamento; histórico completo do monolito continua disponível no git.

| # | Spec | Status |
|---|---|---|
| 01 | [Fundação do MVP](01-fundacao-mvp/spec.md) — modelo de dados, contratos Liveblocks, rotas, auth, fases, fontes de vídeo, direção visual | implementado |
| 02 | [Tela cheia centrada, diagnóstico de lag e teto de qualidade](02-fullscreen-lag-qualidade/spec.md) | implementado |
| 03 | [Auditoria UI/UX](03-auditoria-ui-ux/spec.md) — achados e correções, rodada 1 | implementado |
| 04 | [Auditoria UI/UX — rodada 2](04-auditoria-ui-ux-rodada-2/spec.md) — medição em navegador real, 28 achados | implementado |
| 05 | [Code review — bypass de autorização, injeção de conteúdo e bugs funcionais](05-code-review-seguranca/spec.md) | implementado |
| 06 | [Revisão de consistência de design](06-consistencia-design/spec.md) | implementado |
| 07 | [Achados pós-deploy](07-achados-pos-deploy/spec.md) — teste real do usuário em produção, sete pedidos | **pendente** |
| 08 | [Otimização de sync de vídeo e scroll do chat](08-otimizacao-sync-video-scroll-chat/spec.md) — redução de rollback e remoção da barra de scroll | rascunho |

A pasta é numerada, não datada — as rodadas 02 a 14 do arquivo original foram todas escritas em
2026-08-20/21, então uma data não separaria a ordem real de nada.
