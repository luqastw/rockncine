# Pesquisa original — Otimização para PCs fracos (resolução client-side, FPS e modo economy)

> Conteúdo migrado verbatim de `spec.md` em 2026-09-18, ao mover esta spec para o formato SDD.
> Registro histórico da motivação, dos critérios (CA-*) e dos riscos originais.
> As âncoras citadas pelo código continuam resolvendo em `spec.md` — ver Anexo A.

# Otimização para PCs fracos — resolução client-side, FPS e modo economy

**Status:** implementado

Especificação motivada por relatos de vídeo travando em computadores de baixa performance durante
watch-parties. O objetivo é reduzir o consumo de recursos do client sem quebrar a experiência de
sincronização, e dar controle ao usuário sobre a qualidade de reprodução.

---

## 1. Problema / motivação

Em máquinas com CPU/GPU limitada (Chromebooks, PCs antigos, máquinas com pouca RAM), o vídeo
pode travar durante a reprodução — especialmente em salas grandes com chat ativo e múltiplas
presenças atualizando em tempo real. O teto de 720p (implementado em `02-fullscreen-lag-qualidade`)
ajuda, mas não é suficiente quando o gargalo é CPU, não largura de banda.

Além disso, não há como o usuário escolher uma resolução menor quando o 720p já é o teto —
em telas pequenas ou conexões lentas, 480p seria preferível.

---

## 2. Objetivos

1. **Botão de resolução** no player para alternar entre 720p e 480p (client-side).
2. **Controle de FPS** com opções de 30fps e 60fps.
3. **Modo economy** que reduz consumo de recursos: desabilitar animações CSS, simplificar
   renderização do chat, limitar frequência de atualizações de presença.
4. **Detecção automática** de dispositivo fraco com sugestão de modo economy na primeira visita.

---

## 3. Não-objetivos (fora do escopo)

- **Transcodificação server-side**: não vamos gerar variantes de resolução no backend. A seleção
  é 100% client-side, limitada pelo que o manifest HLS já oferece.
- **Controle de qualidade do YouTube**: a API pública de qualidade (`setPlaybackQuality`) foi
  removida em 2019. O botão aparece desabilitado com dica de que o YouTube controla a qualidade
  automaticamente.
- **Controle de qualidade em .mp4/.webm**: arquivos únicos sem variantes. O botão aparece
  desabilitado com dica de que a fonte não suporta mudança de resolução.
- **Adaptação automática de resolução baseada em rede**: o ABR do hls.js já cuida disso. O
  botão define um teto, não uma resolução fixa.
- **Download de vídeo em baixa resolução**: a reprodução é streaming, não download.
- **Mudanças no endpoint /api/resolve-embed**: a URL .m3u8 é repassada cruamente; o cliente
  resolve variantes via hls.js.

---

## 4. Histórias de usuário

### H1 — Escolher resolução manualmente
**Como** usuário em um PC fraco,
**quero** um botão ao lado do volume para alternar entre 720p e 480p,
**para** que o vídeo não trave mesmo com CPU limitada.

### H2 — Limitar FPS
**Como** usuário em um dispositivo com tela de 60hz e CPU limitada,
**quero** poder limitar a reprodução a 30fps,
**para** reduzir o uso de CPU sem perda perceptível de qualidade.

### H3 — Ativar modo economy
**Como** usuário em um Chromebook ou PC muito antigo,
**quero** um modo que reduza tudo ao mínimo (animações, chat, presença),
**para** participar de watch-parties sem travamentos.

### H4 — Detecção automática
**Como** usuário pela primeira vez em um dispositivo fraco,
**quero** receber uma sugestão de ativar o modo economy,
**para** não precisar descobrir as configurações manualmente.

---

## 5. Critérios de aceite

### 5.1 Botão de resolução

- [ ] **CA-1.1**: Um botão de resolução é renderizado na barra de controles do player,
  posicionado entre o slider de volume e o botão de fullscreen.
- [ ] **CA-1.2**: O botão exibe a resolução atual ("720p" ou "480p") como texto.
- [ ] **CA-1.3**: Ao clicar, alterna entre 720p e 480p. O ciclo é: 720p → 480p → 720p.
- [ ] **CA-1.4**: Para HLS (.m3u8 via hls.js): alterar `hls.autoLevelCapping` dinamicamente
  para o maior nível com `height <= 480` quando em 480p, e `height <= 720` quando em 720p.
  O ABR continua funcionando abaixo do teto.
- [ ] **CA-1.5**: Para Vimeo: chamar `player.setQuality('480p')` ou `player.setQuality('720p')`
  conforme a seleção. Se a qualidade não estiver disponível no vídeo, manter a selecionada
  e exibir tooltip informativo.
- [ ] **CA-1.6**: Para YouTube: botão renderizado com aparência desabilitada (opacity-50,
  cursor-not-allowed) e tooltip "O YouTube controla a qualidade automaticamente".
- [ ] **CA-1.7**: Para .mp4/.webm: botão renderizado com aparência desabilitada e tooltip
  "Esta fonte não suporta mudança de resolução".
- [ ] **CA-1.8**: A resolução selecionada persiste durante a sessão (localStorage) e entre
  sessões no mesmo device.
- [ ] **CA-1.9**: Trocar de resolução não causa restart do vídeo. A posição de playback e
  o estado de play/pause são mantidos.
- [ ] **CA-1.10**: Em Safari (onde hls.js não é usado e HLS roda nativo), o botão aparece
  desabilitado com dica "Safari controla a qualidade automaticamente".

### 5.2 Controle de FPS

- [ ] **CA-2.1**: Um seletor de FPS é renderizado no player, posicionado ao lado do botão
  de resolução (ou no menu de configurações, se houver).
- [ ] **CA-2.2**: Opções disponíveis: "Automático" (padrão), "30fps", "60fps".
- [ ] **CA-2.3**: Ao selecionar 30fps, aplicar limitação via `requestVideoFrameCallback` com
  throttle, ou via configuração do hls.js (`maxMaxBufferLength` para reduzir buffer e frames
  processados. `playbackRate` NÃO é usado (muda velocidade, não FPS).
- [ ] **CA-2.4**: A seleção de FPS persiste em localStorage.
- [ ] **CA-2.5**: O seletor está oculto em mobile (touch devices) pois FPS é menos relevante
  e o espaço é limitado.

### 5.3 Modo economy

- [ ] **CA-3.1**: Um toggle "Modo economy" existe nas configurações da sala (no header ou
  em um menu de settings acessível pelo player).
- [ ] **CA-3.2**: Quando ativado, as seguintes reduções são aplicadas:
  - Animações CSS desabilitadas (`prefers-reduced-motion: reduce` forçado via classe no `<html>`).
  - Chat em modo texto puro: sem animações de entrada de mensagem, sem avatares, sem
    scrolling suave — mensagens aparecem instantaneamente.
  - Presença: throttle de atualização aumentado de 80ms para 500ms (Liveblocks `throttle`).
  - SyncRing: animação de pulso desabilitada.
- [ ] **CA-3.3**: O estado do modo economy persiste em localStorage.
- [ ] **CA-3.4**: Quando o modo economy está ativo, o botão de resolução força 480p
  automaticamente (independente da seleção anterior).
- [ ] **CA-3.5**: Um indicador visual discreto (badge "Economy") aparece no header da sala
  quando o modo está ativo.

### 5.4 Detecção automática

- [ ] **CA-4.1**: Na primeira visita (sem localStorage), executar uma heurística leve para
  detectar dispositivo fraco: `navigator.hardwareConcurrency <= 2` OU
  `navigator.deviceMemory < 4` (quando disponível).
- [ ] **CA-4.2**: Se a heurística detectar dispositivo fraco, exibir um toast/banner não
  intrusivo: "Detectamos que seu dispositivo pode ter dificuldades com vídeo. Ativar modo
  economy?" com botões "Sim" e "Agora não".
- [ ] **CA-4.3**: Se o usuário aceitar, ativar modo economy e forçar 480p.
- [ ] **CA-4.4**: Se o usuário recusar, não sugerir novamente na mesma sessão.
- [ ] **CA-4.5**: A heurística roda apenas uma vez (resultado salvo em localStorage para
  não repetir).

---

## 6. Riscos / dependências conhecidos

1. **hls.js `autoLevelCapping` dinâmico**: não há documentação oficial de que trocar o cap
   em runtime é seguro após o manifest já ter sido parseado. Testar se o ABR respeita o novo
   cap sem necessidade de `destroy()`/`recoverMediaError()`. Se não funcionar, fallback para
   forçar `hls.currentLevel` (perde ABR, mas garante a resolução).

2. **Vimeo `setQuality()`**: depende do plano de upload do vídeo. Vídeos em plano gratuito
   podem não ter variantes de 480p. Tratar erro silenciosamente e manter qualidade atual.

3. **FPS limit via `requestVideoFrameCallback`**: não há padrão universal. Em browsers que
   não suportam (Firefox em certain modes), a limitação pode não funcionar. Fallback:
   não aplicar limite e exibir dica de que o browser controla o FPS.

4. **Modo economy + Liveblocks throttle**: aumentar o throttle de 80ms para 500ms pode
   causar "teletransporte" de cursor nos participantes. Testar se a experiência continua
   aceitável.

5. **Detecção de dispositivo fraco**: `navigator.deviceMemory` não é suportado em todos
   os browsers (Safari não expõe). A heurística deve ser graceful degradation — se não
   puder detectar, não sugere.

6. **Sincronização**: nenhuma mudança deve afetar o drift correction ou o sync entre
   participantes. A resolução e FPS são **locais** — cada participante pode ter qualidade
   diferente sem impactar o sync.
