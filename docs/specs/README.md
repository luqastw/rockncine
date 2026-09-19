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
| 02 | [Tela cheia centrada, diagnóstico de lag e teto de qualidade](02-fullscreen-lag-qualidade/spec.md) | implementado (itens 3, 4 e 6 da seção 9.3 seguem sem medição — ver `research.md`) |
| 03 | [Auditoria UI/UX](03-auditoria-ui-ux/spec.md) — achados e correções, rodada 1 | implementado |
| 04 | [Auditoria UI/UX — rodada 2](04-auditoria-ui-ux-rodada-2/spec.md) — 28 achados | implementado (achados 9 e 22 sem teste em device real de 390px) |
| 05 | [Code review — bypass de autorização, injeção de conteúdo e bugs funcionais](05-code-review-seguranca/spec.md) | implementado |
| 06 | [Revisão de consistência de design](06-consistencia-design/spec.md) | implementado |
| 07 | [Achados pós-deploy](07-achados-pos-deploy/spec.md) — teste real do usuário em produção, sete pedidos | implementado (item 14.5 pendente) |
| 08 | [Otimização de sync de vídeo e scroll do chat](08-otimizacao-sync-video-scroll-chat/spec.md) — redução de rollback e remoção da barra de scroll | implementado (CA1.2 parcial) |
| 09 | [Resolução client-side, FPS e modo economy](09-resolucao-client/spec.md) | implementado |
| 10 | [Exclusão de sala pelo dono e limite de histórico do chat](10-exclusao-sala-limite-chat/spec.md) | implementado (verificação manual em navegador pendente) |

A pasta é numerada, não datada — as rodadas 02 a 14 do arquivo original foram todas escritas em
2026-08-20/21, então uma data não separaria a ordem real de nada.

---

## Convenção desta pasta (formato SDD)

As specs 01 a 09 foram migradas para o formato SDD em **2026-09-18** (a 10 já nasceu nele). Toda
spec nova segue esta convenção:

| Arquivo | Papel |
|---|---|
| `spec.md` | O **contrato**: problema, objetivos e não-objetivos, histórias (`US-`), requisitos funcionais em sintaxe EARS com ID estável (`FR-001`), critérios de aceite em Given-When-Then (`AC-001`), NFRs quantificados, riscos. Alvo de 1–3 páginas. |
| `research.md` | O **registro histórico** do diagnóstico: medições, vereditos, itens descartados, código citado por linha. Nas specs 01–09 é o conteúdo verbatim do `spec.md` anterior à migração. |
| `tasks.md` | As tarefas (`T-001`...) com os `FR-`/`AC-` cobertos e a prova de cada uma. Nas specs migradas é **reconstrução histórica** (o trabalho já aconteceu); na 10 é o plano executado. |

Regras que valem para toda spec nova:

- ID de requisito e de critério **nunca é reutilizado nem renumerado** depois de publicado — plano,
  código e tarefas referenciam por ID.
- Todo `AC-` precisa ter como falhar: `Then` observável (texto exato, status, valor, medida).
- NFR só entra **com número**. Adjetivo sem unidade não é requisito.
- Não-objetivos são obrigatórios (mínimo 1 linha) — é o que impede a implementação de crescer além
  do pedido.

### Âncoras citadas pelo código

O código comenta referenciando a spec de origem (`(achado 5, docs/specs/05-.../spec.md)`,
`docs/specs/02-.../spec.md, seção 9.4`). Por isso cada spec migrada tem um **Anexo A — numeração
legada**, que preserva os números originais (`seção 9.1`, `achado 5`, `CA1.2`) apontando para os
`FR-`/`AC-` que hoje são donos daquele comportamento.

`anchors.test.ts` (nesta pasta) roda junto da suíte e **falha o build** quando uma citação do código
aponta para spec, seção ou achado que não existe mais. Ele não julga se a âncora aponta para o
achado semanticamente certo — só se ela continua existindo onde o código diz que existe.

**Histórico desta dívida (2026-09-18).** Havia 8 comentários apontando para a spec 04 com o número
errado — eles descreviam achados que na verdade estão na 05 (injeção de `embedUrl` = achado 2,
overlay de erro = achado 3, aviso de entrada = achado 4, sequestro de Ctrl/Cmd+F = achado 5,
bypass de autorização = achado 1) e na 06 (letterbox vs `--scrim` = achado 5). As citações foram
corrigidas junto com as referências a `SPEC.md` em `app/globals.css` e `.env.example`, que apontavam
para um arquivo que virou stub em 2026-08-21.

---

## Notas de status

**Correções de status (2026-09-18).** As linhas 07, 08 e 09 estavam desatualizadas: a 07 aparecia
como "pendente" com 14.1-14.4/14.6-14.7 já implementados (só o 14.5, código de sala de 8 → 4
caracteres, segue aberto em `lib/room-code.ts`); a 08 aparecia como "rascunho" e está implementada,
com o CA1.2 atendido só em parte (o cooldown do YouTube mudou de duração, 400 → 1500 ms, mas
continua sendo timeout fixo em vez de resolução por evento); e a 09 não estava na tabela.

**Pendências que sobrevivem à migração:** item 14.5 da spec 07 (decisão de produto); CA1.2 da spec
08 (exige teste com dois navegadores); itens 3/4/6 da seção 9.3 da spec 02 (sem medição); achados 9
e 22 da spec 04 (sem device de 390px); e a verificação manual em navegador da spec 10.
