# Pesquisa original — Otimização de sincronização de vídeo e scroll do chat

> Conteúdo migrado verbatim de `spec.md` em 2026-09-18, ao mover esta spec para o formato SDD.
> Registro histórico do diagnóstico: medições, vereditos e código citado por linha.
> As âncoras citadas pelo código continuam resolvendo em `spec.md` — ver Anexo A.

# Spec 08 — Otimização de sincronização de vídeo e scroll do chat

## Problema / motivação

Dois problemas foram reportados em uso real do RockNCine:

### 1. Rollback involuntário no vídeo

Usuários relatam que o vídeo "volta no tempo" — um seek automático para uma posição anterior — sem padrão aparente (não se limita a entrada de usuário, troca de aba ou conexão ruim). A análise do codebase identificou a causa provável: o mecanismo de **drift correction** que roda a cada 3 segundos e compara o tempo local com o tempo esperado do storage. Se a diferença ultrapassa 1.5s, um seek forçado é aplicado. Isso é correto em teoria, mas na prática:

- O `REMOTE_APPLY_COOLDOWN_MS` (400ms) pode ser insuficiente para que o player (especialmente YouTube) complete o seek, causando liberação prematura do flag `isApplyingRemoteRef` e permitindo seeks encadeados.
- O YouTube IFrame API não emite evento de seeked, tornando a detecção de seek completado menos confiável que no Vimeo ou `<video>` nativo.
- A combinação de polling de tempo (400ms no YouTube) + drift check (3s) + event listener pode gerar estados transitórios onde o tempo local momentaneamente diverge do esperado, trigando um seek desnecessário.

### 2. Barra de scroll visível no chat

A barra de scroll padrão do navegador no chat (`overflow-y-auto` sem customização) destoa do design monocromático e minimalista do projeto. O usuário deseja removê-la visualmente, mas manter a funcionalidade de scroll (mouse, trackpad, teclado).

---

## Objetivos

1. **Reduzir rollback no vídeo** — diminuir a frequência de seeks automáticos indesejados causados por drift correction, mantendo sincronização entre participantes.
2. **Esconder a barra de scroll do chat** — remover o visual da scrollbar nativa mantendo capacidade de scroll por mouse/trackpad/teclado.

## Não-objetivos

- Remodelar a arquitetura de sincronização (Liveblocks storage/events continua sendo a fonte de verdade).
- Adicionar persistência de mensagens do chat (continua efêmero).
- Alterar o comportamento de late-join ou stale snapshot (spec 01 já trata).
- Modificar o design visual do chat além do scroll.
- Adicionar novos controles de player ou mudar o layout da sala.

---

## Casos de uso / histórias de usuário

### H1: Assistente não sofre rollback durante sessão estável
**Como** usuário assistindo um vídeo com outros participantes,
**Quero** que o vídeo não pule para trás aleatoriamente,
**Para que** a experiência de assistir junto seja contínua e sem interrupções.

### H2: Scroll no chat permanece funcional sem barra visual
**Como** usuário conversando no chat,
**Quero** rolar as mensagens com mouse/trackpad/teclado sem ver a barra de scroll,
**Para que** a interface fique limpa e coerente com o design do projeto.

---

## Critérios de aceite

### CA1: Rollback reduzido

- [ ] CA1.1: O threshold de drift (`DRIFT_THRESHOLD_S`) aumenta progressivamente ou se adapta ao tipo de player (YouTube mais permissivo que `<video>` nativo), evitando seeks em flutuações normais de timing.
- [ ] CA1.2: O cooldown `REMOTE_APPLY_COOLDOWN_MS` para YouTube usa resolução por Promise/evento em vez de timeout fixo de 400ms (padrão já usado em `useVimeoSync`), garantindo que o flag só libere quando o seek de fato completou.
- [ ] CA1.3: A tolerância de drift para YouTube é pelo menos 2x maior que para `<video>` nativo (YouTube API tem latência intrínseca maior).
- [ ] CA1.4: O comportamento de drift para o *dono da última ação* (`isOwner && isPaused`) mantém o threshold atual de 2s (seek-while-pausado não deve ser alterado).
- [ ] CA1.5: Testes unitários em `playerController.test.ts` cobrem os novos thresholds/tolerâncias.

### CA2: Scroll do chat

- [ ] CA2.1: A barra de scroll do chat é invisível em todos os navegadores (Firefox: `scrollbar-width: none`; Chrome/Safari: `::-webkit-scrollbar { display: none }`).
- [ ] CA2.2: O scroll por mouse wheel, trackpad, e setas do teclado continua funcionando normalmente.
- [ ] CA2.3: O scroll automático ao enviar mensagem e o botão "novas mensagens ↓" continuam funcionando como antes.
- [ ] CA2.4: A alteração é aplicada apenas ao chat, não a outros elementos scrolláveis (PresenceList, stage).

---

## Riscos e dependências conhecidos

1. **Threshold adaptativo pode atrasar sincronização real**: se o drift threshold for muito alto, participantes com conexão ruim poderão ficar mais tempo dessincronizados antes de correção. Mitigar com teto (ex.: máximo 5s) e monitorar feedback.

2. **`scrollbar-width: none` tem suporte limitado em Safari < 16**: Safari < 16 não suporta `scrollbar-width`. Neste caso, o fallback via `::-webkit-scrollbar { display: none }` cobre. Verificar versão mínima suportada pelo projeto.

3. **YouTube API é uma caixa-preta**: a(latência do seek via `player.seekTo()` não é mensurável via Promise. A melhoria em CA1.2 pode precisar de um timeout de fallback (ex.: 1500ms) caso o evento `onStateChange` não dispare após seek.

4. **Impacto no spec 07 (achados pós-deploy)**: alguns achados da spec 07 podem se sobrepor — verificar antes de implementar para evitar retrabalho.
