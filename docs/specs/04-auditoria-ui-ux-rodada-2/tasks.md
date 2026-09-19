# Tarefas — auditoria UI/UX rodada 2

Reconstrução histórica — o trabalho já foi implementado; não é um plano a executar.

Spec: `spec.md` · Pesquisa: `research.md`

---

## T-001 — Camada de captura de ponteiro e pilha de z-index
**Objetivo:** devolver a área do player ao documento em fontes controláveis e ordenar as camadas.
**Arquivos tocados:** `components/room/player/PlayerShell.tsx`; `components/room/RoomExperience.tsx`
**Cobre:** FR-001, FR-002, FR-003 / AC-001, AC-002, AC-003
**Prova:** verificação no navegador contra o build de produção — `MutationObserver` registra a barra
voltando a `opacity: 1` com mouse real sobre a área do iframe; `elementFromPoint` no botão de tela
cheia devolve o botão da barra.

## T-002 — Barra de controles alcançável por teclado
**Objetivo:** tirar o estado escondido da barra da armadilha de `visibility: hidden` e revelá-la ao
foco.
**Arquivos tocados:** `components/room/player/PlayerShell.tsx`
**Cobre:** FR-004 / AC-004
**Prova:** tipo/lint/leitura (não exercitado no navegador).

## T-003 — Teto de altura do vídeo fora da tela cheia
**Objetivo:** manter o rodapé do vídeo acima da dobra sem rolagem de página, sem descolar a moldura
de sync do vídeo.
**Arquivos tocados:** `components/room/RoomExperience.tsx`
**Cobre:** FR-005 / AC-005
**Prova:** medição no navegador — `scrollHeight == innerHeight`; vídeo de 649px com rodapé em 750 de
810.

## T-004 — Tela cheia por CSS (iOS Safari)
**Objetivo:** dar saída para o caso em que `requestFullscreen` não existe para elemento comum.
**Arquivos tocados:** `components/room/RoomExperience.tsx`
**Cobre:** FR-006 / AC-006
**Prova:** tipo/lint/leitura.

## T-005 — Aceitar link colado sem esquema
**Objetivo:** parar de responder "link inválido" a links válidos sem `https://`, sem aceitar texto
solto.
**Arquivos tocados:** `lib/video-source.ts`; `components/room/player/LoadVideoModal.tsx`
**Cobre:** FR-007, FR-008 / AC-007, AC-008, AC-009
**Prova:** verificação no navegador (link sem esquema carregando o player) e requisição real a
`POST /api/resolve-embed`; leitura para o guarda de hostname com ponto.

## T-006 — Caminho de convite (código, cópia e busca tolerante)
**Objetivo:** gerar código legível, oferecer cópia com confirmação e resolver a sala com o código
ditado em qualquer caixa.
**Arquivos tocados:** `lib/room-code.ts`; `app/rooms/new/route.ts`; `components/room/InviteCode.tsx`;
`app/rooms/[code]/layout.tsx`; `app/rooms/[code]/page.tsx`
**Cobre:** FR-009, FR-010, FR-011 / AC-010, AC-011, AC-012, AC-013, AC-014
**Prova:** verificação no navegador — sala nova nasce com código de 8 caracteres e botão de copiar.
**Nota histórica:** a busca tolerante (`mode: "insensitive"`) foi depois endurecida pela spec 05
(achado 1) para duas igualdades exatas.

## T-007 — Sair da sala, sair da conta e lista de salas
**Objetivo:** fechar o fluxo de reencontro da sala e o de encerrar a sessão.
**Arquivos tocados:** `components/SignOutButton.tsx`; `app/rooms/page.tsx`;
`components/room/RoomExperience.tsx`
**Cobre:** FR-012 / AC-015
**Prova:** visto em tela de passagem.

## T-008 — Seek por teclado e relógio do scrubber
**Objetivo:** fazer o range buscar no vídeo por teclado e o relógio voltar a acompanhar.
**Arquivos tocados:** `components/room/player/PlayerControls.tsx`
**Cobre:** FR-013 / AC-016
**Prova:** tipo/lint/leitura.

## T-009 — Estado honesto da sala (clamp, staleness, badge e pagehide)
**Objetivo:** parar de mentir "ao vivo" e de buscar além do fim do vídeo numa sala reaberta.
**Arquivos tocados:** `hooks/playerController.ts`; `hooks/useYouTubeSync.ts`;
`hooks/useVimeoSync.ts`; `hooks/useNativeVideoSync.ts`; `components/room/RoomExperience.tsx`
**Cobre:** FR-014, FR-015 / AC-017, AC-018
**Prova:** verificação no navegador — recarga durante a reprodução mostra "pausado" honesto e
posição preservada.

## T-010 — Skeleton enquanto o storage carrega
**Objetivo:** distinguir "storage carregando" de "sala sem vídeo".
**Arquivos tocados:** `components/room/RoomExperience.tsx`
**Cobre:** FR-016 / AC-019
**Prova:** verificação no HTML do primeiro paint — contém "carregando a sala" e não contém "nenhum
vídeo carregado".

## T-011 — Casca de altura fixa para largura estreita
**Objetivo:** manter vídeo e chat na viewport sem rolagem de página abaixo de `lg`.
**Arquivos tocados:** `components/room/RoomExperience.tsx`
**Cobre:** FR-017 / AC-020
**Prova:** medição emulando as regras de mobile (variante `lg:` removida do wrapper, stage em coluna,
`main` de altura fixa).

## T-012 — Contraste de contorno, tipografia e progresso
**Objetivo:** subir o contorno de campo a ≥ 3:1, aplicar o papel Display ao título da sala e fazer o
scrubber/volume comunicarem progresso.
**Arquivos tocados:** `LoginForm`, `RegisterForm`, `JoinRoomForm`, `Chat`, `CreateRoomForm`,
`LoadVideoModal`; `components/room/RoomExperience.tsx`; `app/globals.css`;
`components/room/player/PlayerControls.tsx`
**Cobre:** FR-018, FR-019, FR-020 / AC-021, AC-022, AC-023
**Prova:** vista em tela de passagem (contraste/Display) e zoom no scrubber.

## T-013 — Chat, anúncios, formulários e acessibilidade
**Objetivo:** parar o chat de sequestrar a rolagem, anunciar erros/conexão e fechar os pisos de
acessibilidade.
**Arquivos tocados:** `Chat.tsx`; `LoginForm`, `RegisterForm`, `LoadVideoModal`;
`components/room/RoomExperience.tsx`; `components/room/GenericIframe.tsx`;
`components/room/player/PlayerControls.tsx`
**Cobre:** FR-021, FR-022, FR-023, FR-024, FR-025, FR-026, FR-027 / AC-024 a AC-030
**Prova:** tipo/lint/leitura.

## T-014 — Shell da app, badge do Liveblocks e presença
**Objetivo:** dar retorno visual ao carregar/criar, reservar espaço ao badge obrigatório e deduplicar
a presença.
**Arquivos tocados:** `app/rooms/[code]/loading.tsx`; `app/error.tsx`;
`components/CreateRoomForm.tsx`; `components/room/RoomExperience.tsx`;
`components/room/PresenceList.tsx`
**Cobre:** FR-028, FR-029, FR-030 / AC-031, AC-032, AC-033
**Prova:** verificação da geometria do badge no navegador; presença vista em tela de passagem.

## T-015 — Atalhos de teclado e nota da última ação
**Objetivo:** operar o player por teclado e explicar por que o vídeo parou.
**Arquivos tocados:** `components/room/RoomExperience.tsx`; `components/room/LastActionNote.tsx`
**Cobre:** FR-031, FR-032 / AC-034, AC-035, AC-036
**Prova:** tipo/lint/leitura.

---

## Verificação e limites

- Reverificados no navegador (build de produção, medição no DOM): achados 1, 2, 4, 5, 6, 9, 10, 11,
  13 e 25.
- Checados só por tipo/lint/leitura: achados 3, 8, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 27 e 28.
- Pendência explícita para a próxima rodada: os achados 9 e 22 não foram testados em dispositivo
  real de 390px; os itens 3, 4 e 6 da seção 9.3 da spec 02 seguem sem medição e sem correção.
