# Spec: resolução client-side, FPS e modo economy

**Status:** implementado
**Pesquisa:** `research.md` · plano de execução legado: `research-tasks.md`

## 1. Problema / motivação

Em máquinas com CPU/GPU limitada (Chromebooks, PCs antigos, pouca RAM), o vídeo pode travar durante
watch-parties, sobretudo em salas grandes com chat ativo e presenças atualizando em tempo real. O
teto de 720p (da spec `02-fullscreen-lag-qualidade`) ajuda quando o gargalo é largura de banda, mas
não quando o gargalo é CPU; além disso, não há como o usuário escolher uma resolução menor que 720p,
nem limitar FPS, nem reduzir o custo do client.

## 2. Objetivos e não-objetivos

**Objetivos**

1. Botão de resolução no player para alternar entre 720p e 480p (client-side).
2. Controle de FPS com opções de 30fps e 60fps.
3. Modo economy que reduz o consumo: desabilitar animações CSS, simplificar o chat, limitar a
   frequência de atualizações de presença.
4. Detecção automática de dispositivo fraco com sugestão de modo economy na primeira visita.

**Não-objetivos (fora do escopo)**

- Transcodificação server-side: a seleção é 100% client-side, limitada pelo manifest HLS.
- Controle de qualidade do YouTube: a API `setPlaybackQuality` foi removida em 2019; o botão aparece
  desabilitado com dica.
- Controle de qualidade em `.mp4`/`.webm`: arquivos únicos sem variantes; o botão aparece desabilitado.
- Adaptação automática de resolução por rede: o ABR do hls.js já cuida; o botão define um teto, não
  uma resolução fixa.
- Download de vídeo em baixa resolução: a reprodução é streaming.
- Mudanças no endpoint `/api/resolve-embed`: a URL `.m3u8` é repassada cruamente.

## 3. Histórias de usuário

- **US-1**: Como usuário em um PC fraco, quero um botão ao lado do volume para alternar entre 720p e
  480p, para que o vídeo não trave mesmo com CPU limitada.
- **US-2**: Como usuário em um dispositivo de 60 Hz com CPU limitada, quero limitar a reprodução a
  30fps, para reduzir o uso de CPU sem perda perceptível.
- **US-3**: Como usuário em um Chromebook muito antigo, quero um modo que reduza tudo ao mínimo
  (animações, chat, presença), para participar de watch-parties sem travamentos.
- **US-4**: Como usuário pela primeira vez em um dispositivo fraco, quero receber uma sugestão de
  ativar o modo economy, para não precisar descobrir as configurações manualmente.

## 4. Requisitos funcionais (EARS)

### Botão de resolução
- **FR-001** O sistema DEVE renderizar um botão de resolução na barra de controles do player,
  posicionado entre o slider de volume e o botão de tela cheia.
- **FR-002** O sistema DEVE exibir no botão a resolução atual ("720p" ou "480p") como texto.
- **FR-003** QUANDO o botão for acionado, o sistema DEVE alternar a resolução no ciclo 720p → 480p →
  720p.
- **FR-004** PARA HLS via hls.js, QUANDO a resolução for 480p, o sistema DEVE limitar
  `hls.autoLevelCapping` ao maior nível com `height <= 480`; para 720p, `height <= 720`, mantendo o
  ABR ativo abaixo do teto.
- **FR-005** PARA Vimeo, QUANDO a resolução mudar, o sistema DEVE chamar
  `player.setQuality("480p" | "720p")`; SE a qualidade não existir no vídeo, ENTÃO o sistema DEVE
  manter a seleção e exibir a dica informativa.
- **FR-006** PARA YouTube, o sistema DEVE renderizar o botão com aparência desabilitada
  (`opacity-50`, `cursor-not-allowed`) e dica "O YouTube controla a qualidade automaticamente".
- **FR-007** PARA `.mp4`/`.webm`, o sistema DEVE renderizar o botão com aparência desabilitada e dica
  "Esta fonte não suporta mudança de resolução".
- **FR-008** O sistema DEVE persistir a resolução selecionada em `localStorage`.
- **FR-009** QUANDO a resolução mudar, o sistema DEVE manter a posição de playback e o estado de
  play/pause, sem reiniciar o vídeo.
- **FR-010** EM Safari (onde o HLS roda nativo, sem hls.js), o sistema DEVE renderizar o botão
  desabilitado com dica "Safari controla a qualidade automaticamente".

### Controle de FPS
- **FR-011** O sistema DEVE renderizar um seletor de FPS no player, ao lado do botão de resolução ou
  em um menu de configurações.
- **FR-012** O seletor DEVE oferecer as opções "Automático" (padrão), "30fps" e "60fps".
- **FR-013** QUANDO "30fps" for selecionado, o sistema DEVE aplicar a limitação via
  `requestVideoFrameCallback` com throttle, ou via configuração do hls.js, e NÃO DEVE usar
  `playbackRate`.
- **FR-014** O sistema DEVE persistir a seleção de FPS em `localStorage`.
- **FR-015** ENQUANTO o dispositivo for touch/mobile, o sistema DEVE ocultar o seletor de FPS.

### Modo economy
- **FR-016** O sistema DEVE oferecer um toggle "Modo economy" nas configurações da sala.
- **FR-017** QUANDO o modo economy for ativado, o sistema DEVE: desabilitar animações CSS (classe no
  `<html>`, `prefers-reduced-motion: reduce`); exibir o chat em texto puro (sem animação de entrada,
  sem avatares, sem scroll suave); aumentar o throttle de presença do Liveblocks de 80 ms para 500 ms;
  e desabilitar o pulso do SyncRing.
- **FR-018** O sistema DEVE persistir o estado do modo economy em `localStorage`.
- **FR-019** QUANDO o modo economy estiver ativo, o sistema DEVE forçar a resolução 480p,
  independentemente da seleção anterior.
- **FR-020** O sistema DEVE exibir um badge discreto "Economy" no header da sala enquanto o modo
  estiver ativo.

### Detecção automática
- **FR-021** NA primeira visita (sem `localStorage`), o sistema DEVE executar a heurística:
  `navigator.hardwareConcurrency <= 2` OU `navigator.deviceMemory < 4` (quando disponível).
- **FR-022** SE a heurística detectar dispositivo fraco, ENTÃO o sistema DEVE exibir um toast/banner
  não intrusivo "Detectamos que seu dispositivo pode ter dificuldades com vídeo. Ativar modo economy?"
  com botões "Sim" e "Agora não".
- **FR-023** SE o usuário aceitar, ENTÃO o sistema DEVE ativar o modo economy e forçar 480p.
- **FR-024** SE o usuário recusar, ENTÃO o sistema NÃO DEVE sugerir novamente na mesma sessão.
- **FR-025** O sistema DEVE salvar na `localStorage` o resultado da heurística, de modo que ela rode
  apenas uma vez.

## 5. Critérios de aceite (Given-When-Then)

Um `When` por cenário; todo `Then` é observável.

### Botão de resolução
- **AC-001** [FR-005] Given um vídeo Vimeo sem variante 480p, When o usuário seleciona 480p, Then a
  seleção permanece "480p" e a dica informativa é exibida.
- **AC-002** [FR-004] Given um HLS carregado em 720p, When o usuário seleciona 480p, Then
  `hls.autoLevelCapping` aponta para o maior nível com `height <= 480` e o ABR segue ativo abaixo do
  teto.
- **AC-003** [FR-004] Given um HLS em 480p, When o usuário seleciona 720p, Then o teto volta ao maior
  nível com `height <= 720`.
- **AC-004** [FR-009] Given um HLS reproduzindo na posição `t` e em play, When o usuário troca
  720p ↔ 480p, Then a posição permanece em `t` (dentro de tolerância) e o estado continua em play, sem
  restart.
- **AC-005** [FR-006] Given a fonte YouTube, When os controles são renderizados, Then o botão de
  resolução está `disabled`, com `opacity-50`/`cursor-not-allowed` e dica "O YouTube controla a
  qualidade automaticamente".
- **AC-006** [FR-007] Given a fonte `.mp4`/`.webm`, When os controles são renderizados, Then o botão
  está desabilitado com dica "Esta fonte não suporta mudança de resolução".
- **AC-007** [FR-010] Given Safari com HLS nativo (sem hls.js), When os controles são renderizados,
  Then o botão está desabilitado com dica "Safari controla a qualidade automaticamente".
- **AC-008** [FR-001] Given um HLS com botão de resolução disponível, When a barra de controles é
  renderizada, Then o botão fica entre o slider de volume e o botão de tela cheia.
- **AC-009** [FR-002] Given a resolução "480p", When o botão é renderizado, Then seu texto é "480p".
- **AC-010** [FR-003] Given "720p" selecionado, When o botão é acionado uma vez, Then a resolução vira
  "480p"; e ao ser acionado de novo, volta para "720p".
- **AC-011** [FR-008] Given "480p" selecionado, When a página é recarregada no mesmo device, Then a
  resolução inicial é "480p".

### Controle de FPS
- **AC-012** [FR-013] Given um HLS em reprodução, When o usuário seleciona 30fps, Then o sistema aplica
  a limitação pelo hls.js e `playbackRate` permanece 1.
- **AC-013** [FR-012] Given o seletor de FPS, When ele é aberto, Then contém "Automático", "30fps" e
  "60fps", com "Automático" como padrão.
- **AC-014** [FR-014] Given "30fps" selecionado, When a página é recarregada, Then o FPS inicial é "30".
- **AC-015** [FR-015] Given um dispositivo touch/mobile, When o player é renderizado, Then o seletor de
  FPS não está presente.
- **AC-016** [FR-011] Given o player, When os controles são renderizados, Then o seletor de FPS fica
  adjacente ao botão de resolução (ou acessível por menu de configurações).

### Modo economy
- **AC-017** [FR-017] Given o modo economy desativado, When o usuário o ativa, Then
  `prefers-reduced-motion: reduce` passa a valer no `<html>`, o chat não anima entrada/avatares/scroll
  suave, o throttle de presença é 500 ms e o SyncRing não pulsa.
- **AC-018** [FR-019] Given resolução "720p" e modo economy desativado, When o modo economy é ativado,
  Then a resolução efetiva vira "480p".
- **AC-019** [FR-018] Given o modo economy ativo, When a página é recarregada, Then o modo continua
  ativo.
- **AC-020** [FR-020] Given o modo economy ativo, When o header da sala é renderizado, Then o badge
  "Economy" está presente.
- **AC-021** [FR-016] Given as configurações da sala, When o usuário abre o menu, Then existe um toggle
  "Modo economy".

### Detecção automática
- **AC-022** [FR-021] Given primeira visita sem `localStorage` e `navigator.hardwareConcurrency = 2`,
  When a heurística roda, Then ela reporta dispositivo fraco.
- **AC-023** [FR-021] Given primeira visita, `navigator.deviceMemory` ausente e `hardwareConcurrency`
  alto, When a heurística roda, Then ela não reporta dispositivo fraco (degradação segura).
- **AC-024** [FR-022] Given a heurística aprovando dispositivo fraco e nenhuma decisão anterior, When o
  `RoomExperience` monta, Then o toast aparece com os botões "Sim" e "Agora não".
- **AC-025** [FR-023] Given o toast visível, When o usuário clica "Sim", Then o modo economy fica ativo
  e a resolução vira "480p".
- **AC-026** [FR-024] Given o toast visível, When o usuário clica "Agora não", Then o toast some e não
  reaparece na mesma sessão.
- **AC-027** [FR-025] Given a heurística já executada (resultado em `localStorage`), When o usuário
  reabre a página, Then a heurística não roda de novo.

## 6. Requisitos não-funcionais (quantificados)

- **Persistência:** 1 chave de `localStorage` (`rockncine-video-quality`) agrega resolução, FPS,
  economy e a decisão da sugestão; valores inválidos caem no default.
- **Throttle de presença:** 80 ms no modo normal; 500 ms no modo economy.
- **Heurística:** roda no máximo 1 vez por dispositivo; custo O(1) — leitura de 2 propriedades de
  `navigator`.
- **Opções:** 2 resoluções (720p, 480p); 3 valores de FPS (auto, 30, 60).
- **Detecção de Safari:** 1 regexp sobre `navigator.userAgent`.
- **Localidade:** resolução e FPS são locais e não afetam o drift correction nem a sincronização entre
  participantes.

## 7. Dados e contratos

- Nenhum endpoint alterado; `/api/resolve-embed` continua repassando a URL `.m3u8` cruamente.
- Contrato do hook `useVideoQuality`: `{ resolution, fpsLimit, economyMode, setResolution, setFpsLimit,
  setEconomyMode, isLowEnd, isSafari, hasSeenSuggestion, dismissSuggestion }`.
- `PlaybackController` estendido com `resolution: "720p" | "480p" | null`, `setResolution?`, `fpsLimit`
  e `setFpsLimit?`; `null` indica fonte sem suporte a mudança de resolução.
- Chave de `localStorage`: `rockncine-video-quality`.

## 8. Riscos / dependências / divergências

1. **`hls.js autoLevelCapping` dinâmico:** não há documentação oficial de que trocar o cap em runtime
   seja seguro após o manifest parseado. Fallback: forçar `hls.currentLevel` (perde ABR, garante a
   resolução).
2. **Vimeo `setQuality()`:** depende do plano de upload; vídeos gratuitos podem não ter 480p. Tratar o
   erro em silêncio e manter a qualidade atual.
3. **FPS via `requestVideoFrameCallback`:** não há padrão universal; em browsers que não suportam, a
   limitação pode não funcionar. Fallback: não aplicar limite e exibir dica.
4. **Modo economy + throttle do Liveblocks:** aumentar de 80 ms para 500 ms pode causar "teletransporte"
   de cursor nos participantes — testar se a experiência continua aceitável.
5. **Detecção de dispositivo fraco:** `navigator.deviceMemory` não é exposto em todos os browsers
   (Safari não expõe). A heurística degrada com segurança — se não puder detectar, não sugere.
6. **Sincronização:** nenhuma mudança deve afetar o drift correction ou o sync entre participantes; a
   resolução e o FPS são locais.

## Anexo A — numeração legada (âncoras citadas pelo código)

O código cita estes IDs diretamente (`spec 09, CA-2.3` em `components/room/RoomExperience.tsx`; e os
blocos de teste em `hooks/useVideoQuality.test.ts` citam `CA-1.8`, `CA-2.4`, `CA-3.3`, `CA-4.1–4.5`,
`CA-4.3` e `CA-4.5`), mas sem o caminho `docs/specs/09-…/spec.md` — por isso são preservados aqui.

| Âncora antiga | O que dizia | Onde vive agora |
|---|---|---|
| CA-1.1 | botão de resolução entre volume e fullscreen | FR-001 / AC-008 |
| CA-1.2 | botão exibe a resolução atual como texto | FR-002 / AC-009 |
| CA-1.3 | ciclo 720p → 480p → 720p | FR-003 / AC-010 |
| CA-1.4 | HLS: `autoLevelCapping` ≤480 / ≤720, ABR mantido | FR-004 / AC-002, AC-003 |
| CA-1.5 | Vimeo: `setQuality` + dica se indisponível | FR-005 / AC-001 |
| CA-1.6 | YouTube: botão desabilitado + dica | FR-006 / AC-005 |
| CA-1.7 | `.mp4`/`.webm`: botão desabilitado + dica | FR-007 / AC-006 |
| CA-1.8 | persistência da resolução em localStorage | FR-008 / AC-011 |
| CA-1.9 | trocar resolução não reinicia o vídeo | FR-009 / AC-004 |
| CA-1.10 | Safari: botão desabilitado + dica | FR-010 / AC-007 |
| CA-2.1 | seletor de FPS ao lado da resolução | FR-011 / AC-016 |
| CA-2.2 | opções "Automático", "30fps", "60fps" | FR-012 / AC-013 |
| CA-2.3 | 30fps via rVFC/hls.js; sem `playbackRate` | FR-013 / AC-012 |
| CA-2.4 | persistência do FPS em localStorage | FR-014 / AC-014 |
| CA-2.5 | seletor oculto em mobile | FR-015 / AC-015 |
| CA-3.1 | toggle "Modo economy" nas configurações | FR-016 / AC-021 |
| CA-3.2 | reduções do economy (animações, chat, presença, SyncRing) | FR-017 / AC-017 |
| CA-3.3 | persistência do economy em localStorage | FR-018 / AC-019 |
| CA-3.4 | economy força 480p | FR-019 / AC-018 |
| CA-3.5 | badge "Economy" no header | FR-020 / AC-020 |
| CA-4.1 | heurística `hardwareConcurrency <= 2` OU `deviceMemory < 4` | FR-021 / AC-022, AC-023 |
| CA-4.2 | toast com "Sim" e "Agora não" | FR-022 / AC-024 |
| CA-4.3 | aceitar ativa economy + 480p | FR-023 / AC-025 |
| CA-4.4 | recusar não sugere de novo na sessão | FR-024 / AC-026 |
| CA-4.5 | heurística roda uma vez (resultado em localStorage) | FR-025 / AC-027 |

Nenhuma destas âncoras é citada **por caminho** no código (`grep -rn "docs/specs/09" app components
hooks lib prisma` não retorna nada); as citações existentes usam o rótulo textual `spec 09, CA…`.
