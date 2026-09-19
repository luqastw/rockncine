# Spec: otimização de sincronização de vídeo e scroll do chat

**Status:** implementado (com ressalvas) — CA1.2 atendido só em parte: o cooldown do YouTube mudou de duração (400 → 1500 ms), mas continua sendo timeout fixo, não resolução por evento.
**Pesquisa:** `research.md`

## 1. Problema / motivação

Dois problemas relatados em uso real do RockNCine:

1. O vídeo "volta no tempo" — um seek automático para uma posição anterior — sem padrão aparente,
   causado em parte pelo mecanismo de drift correction que compara o tempo local com o esperado.
2. A barra de scroll padrão do navegador no chat destoa do design monocromático e minimalista.

O diagnóstico e as medições de cada problema estão em `research.md`.

## 2. Objetivos e não-objetivos

**Objetivos**

1. Reduzir a frequência de seeks automáticos indesejados causados por drift correction, mantendo a
   sincronização entre participantes.
2. Esconder a barra visual de scroll do chat mantendo o scroll por mouse, trackpad e teclado.

**Não-objetivos (fora do escopo)**

- Remodelar a arquitetura de sincronização (Liveblocks storage/events continua sendo a fonte de
  verdade).
- Adicionar persistência de mensagens do chat (continua efêmero).
- Alterar o comportamento de late-join ou stale snapshot (a spec 01 já trata).
- Modificar o design visual do chat além do scroll.
- Adicionar novos controles de player ou mudar o layout da sala.

## 3. Histórias de usuário

- **US-1**: Como usuário assistindo a um vídeo com outros participantes, quero que o vídeo não pule
  para trás aleatoriamente, para que a experiência de assistir junto seja contínua.
- **US-2**: Como usuário conversando no chat, quero rolar as mensagens com mouse/trackpad/teclado sem
  ver a barra de scroll, para que a interface fique coerente com o design do projeto.

## 4. Requisitos funcionais (EARS)

### Drift / rollback
- **FR-001** O sistema DEVE adaptar a tolerância de drift ao tipo de player, de modo que o YouTube seja
  mais permissivo que o `<video>` nativo, evitando seeks em flutuações normais de timing.
- **FR-002** O sistema DEVE tolerar, no YouTube, um drift de pelo menos o dobro da tolerância usada
  para o `<video>` nativo.
- **FR-003** ENQUANTO o participante local for o dono da última ação e o player estiver pausado, o
  sistema DEVE manter a tolerância corrente de 2 s, sem alterar o comportamento de seek-while-pausado.
- **FR-004** QUANDO aplicar um seek remoto no YouTube, o sistema DEVE liberar o flag de guarda no
  momento em que o seek de fato completar (por Promise/evento), em vez de por timeout fixo.

### Scroll do chat
- **FR-005** O sistema DEVE renderizar o chat sem barra de scroll visível em todos os navegadores
  suportados.
- **FR-006** O sistema DEVE manter o scroll do chat funcional por mouse wheel, trackpad e setas do
  teclado.
- **FR-007** O sistema DEVE manter o scroll automático ao enviar mensagem e o botão "novas mensagens ↓"
  funcionando como antes.
- **FR-008** O sistema DEVE aplicar a remoção da barra de scroll somente ao chat, deixando os demais
  elementos scrolláveis (PresenceList, stage) inalterados.

## 5. Critérios de aceite (Given-When-Then)

Um `When` por cenário; todo `Then` é observável.

### Drift / rollback
- **AC-001** [FR-001] Given um `<video>` nativo com drift dentro da tolerância do nativo, When a
  checagem de drift roda, Then nenhum seek é emitido.
- **AC-002** [FR-001] Given um player do YouTube com drift entre a tolerância do nativo e a do YouTube,
  When a checagem de drift roda, Then nenhum seek é emitido.
- **AC-003** [FR-002] Given as constantes de drift configuradas, When a tolerância do YouTube é
  comparada à do nativo, Then YouTube ≥ 2 × nativo.
- **AC-004** [FR-003] Given o participante local como dono da última ação e o player pausado, When o
  drift excede 2 s, Then o sistema corrige a posição (comportamento de seek-while-pausado preservado).
- **AC-005** [FR-003] Given o participante local como dono da última ação e o player pausado, When o
  drift é menor ou igual a 2 s, Then nenhum seek é emitido.
- **AC-006** [FR-004] Given um seek remoto aplicado no YouTube, When o player emite o evento de
  conclusão do seek, Then o flag de guarda é liberado nesse evento. *(parcial: ver §8 — a
  implementação mantém timeout de fallback)*
- **AC-007** [FR-004] Given um seek remoto no YouTube e o evento de conclusão que não chega, When o
  timeout de fallback de 1500 ms expira, Then o flag de guarda é liberado.

### Scroll do chat
- **AC-008** [FR-005] Given o chat com conteúdo excedendo a altura, When renderizado no Firefox, Then a
  barra não é desenhada (`scrollbar-width: none`).
- **AC-009** [FR-005] Given o chat com conteúdo excedendo a altura, When renderizado no Chrome ou no
  Safari, Then a barra não é desenhada (`::-webkit-scrollbar { display: none }`).
- **AC-010** [FR-006] Given o chat com a barra oculta, When o usuário rola com wheel, trackpad ou
  setas, Then a posição de scroll muda.
- **AC-011** [FR-007] Given o usuário posicionado no fim da lista, When ele envia uma mensagem, Then a
  lista rola até o fim.
- **AC-012** [FR-007] Given o usuário rolado para longe do fim, When chega uma nova mensagem, Then o
  botão "novas mensagens ↓" aparece.
- **AC-013** [FR-008] Given a lista de presença e o palco (stage), When renderizados, Then suas barras
  de scroll não são afetadas pela regra aplicada ao chat.

## 6. Requisitos não-funcionais (quantificados)

- **Tolerância de drift:** `<video>` nativo 1,5 s; YouTube 3,0 s (≥ 2× o nativo); seek-while-pausado
  (dono + pausado) 2 s.
- **Cadência de verificação:** checagem de drift a cada 3000 ms; cooldown de aplicação remota de
  1500 ms (fallback do YouTube). Teto proposto para a tolerância adaptativa: ≤ 5 s.
- **Cobertura de teste:** 1 bloco de testes unitários em `hooks/playerController.test.ts` que assere as
  relações entre as tolerâncias e o cooldown (CA1.5).
- **Scroll:** 0 barras visíveis no chat; 100% dos demais scrolláveis inalterados.

## 7. Dados e contratos

- Nenhum dado novo; a sincronização permanece no storage/events do Liveblocks.
- Constantes de sincronização em `hooks/playerController.ts`: `DRIFT_THRESHOLD_NATIVE_S`,
  `DRIFT_THRESHOLD_YOUTUBE_S`, `CHECK_INTERVAL_MS`, `SEEK_WHILE_PAUSED_THRESHOLD_S`,
  `REMOTE_APPLY_COOLDOWN_MS`.
- Uma classe utilitária de scroll (`.scrollbar-hidden`) é aplicada apenas ao chat.

## 8. Riscos / dependências / divergências

- **Divergência de status (2026-09-18).** O `spec.md` original não tinha linha de `Status` e deixava os
  itens `CA1.1`–`CA2.4` desmarcados, apesar de a spec estar implementada. O `CA1.2` está **parcial**: o
  cooldown do YouTube mudou de duração (400 → 1500 ms) mas continua sendo timeout fixo, não resolução
  por evento (ver AC-006 e AC-007).
- **Dependência da spec 02 (§9.3, itens 3, 4 e 6 — drift, cooldown e `overflow-hidden`).** A spec 04
  registra esses três itens como pendências sem medição e sem correção. Esta spec 08 cobre parte do
  item 4 (cooldown) e o item 3 (drift); o item 6 (`overflow-hidden` na caixa do vídeo) permanece fora
  desta spec.
- **YouTube é caixa-preta.** A latência do `seekTo()` não é mensurável por Promise; por isso o
  cooldown mantém um timeout de fallback (1500 ms) para o caso do evento de conclusão não disparar.
- **Threshold adaptativo.** Se a tolerância for alta demais, participantes com conexão ruim ficam
  dessincronizados por mais tempo; mitigar com teto ≤ 5 s e monitorar.
- **`scrollbar-width: none` em Safari < 16.** Não suportado; o fallback `::-webkit-scrollbar { display:
  none }` cobre.

## Anexo A — numeração legada (âncoras citadas pelo código)

O código cita estes IDs diretamente (`spec 08, CA1.1/CA1.3` em `hooks/playerController.ts`,
`spec 08, CA1.2` em `hooks/useYouTubeSync.ts`, `spec 08, CA2.1` em `app/globals.css`), mas sem o
caminho `docs/specs/08-…/spec.md` — por isso são preservados aqui como âncora legada.

| Âncora antiga | O que dizia | Onde vive agora |
|---|---|---|
| CA1.1 | threshold de drift adaptativo por tipo de player | FR-001 / AC-001, AC-002 |
| CA1.2 | cooldown do YouTube por Promise/evento, não timeout fixo | FR-004 (parcial — AC-006 não atendido; fallback em AC-007) |
| CA1.3 | tolerância do YouTube ≥ 2× a do nativo | FR-002 / AC-003 |
| CA1.4 | dono + pausado mantém o threshold de 2 s | FR-003 / AC-004, AC-005 |
| CA1.5 | testes unitários cobrem os thresholds/tolerâncias | NFR (cobertura de teste) |
| CA2.1 | barra de scroll invisível (Firefox `scrollbar-width`; webkit `display: none`) | FR-005 / AC-008, AC-009 |
| CA2.2 | scroll por mouse wheel, trackpad e teclado | FR-006 / AC-010 |
| CA2.3 | auto-scroll ao enviar + botão "novas mensagens ↓" | FR-007 / AC-011, AC-012 |
| CA2.4 | alteração aplicada só ao chat | FR-008 / AC-013 |

Nenhuma destas âncoras é citada **por caminho** no código (`grep -rn "docs/specs/08" app components
hooks lib prisma` não retorna nada); as citações existentes usam o rótulo textual `spec 08, CA…`.
