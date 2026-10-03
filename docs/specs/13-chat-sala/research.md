# Pesquisa: chat da sala — diagnóstico medido

Registro do diagnóstico que produziu a spec 13. Data da medição: 2026-10-03.

## 1. Instrumento

Um teste descartável foi montado em cima da infraestrutura de `RoomExperience.test.tsx`
(`@liveblocks/react` e os três hooks de sync mockados, `useChat` e `Chat` **reais**), com dois
contadores:

- um componente no lugar de `PresenceList` que conta os próprios renders;
- um patch de `Date.prototype.toLocaleTimeString` contando chamadas.

Medido em jsdom (Node), não em navegador. Contagens de render e de chamadas são válidas em jsdom;
tempo em ms não é, e por isso nenhum tempo aparece aqui.

## 2. Resultados

| Medida | Valor |
|---|---|
| Itens no log com o feed cheio | 30 |
| Renders do contador ao encher as 30 mensagens | 31 |
| Renders por mensagem recebida | 1 |
| Renders por tecla digitada (fora do log) | 0 |
| `toLocaleTimeString` por mensagem recebida | 30 |
| `toLocaleTimeString` por tecla digitada (steady state) | 30 |
| `toLocaleTimeString` na primeira tecla | 60 |

Leituras:

1. **A cascata existe.** Uma mensagem recebida redesenha a sala inteira uma vez. É a mesma estrutura
   do defeito do playhead (README, seção "Bundle") — o clock foi para fora do React, o feed não foi.
2. **O `draft` está bem isolado.** `draft` é estado do `Chat`, então digitar não acorda a sala
   (`Chat.tsx:25`); o custo por tecla é todo dentro do log.
3. **O custo por tecla é O(mensagens).** 30 formatações de `Intl` por tecla, com um pico de 60 na
   primeira (a tecla entra junto de um render extra de montagem da lista; não investigado, e
   irrelevante para o custo steady state).

## 3. Estado atual citado por linha

| Fato | Onde |
|---|---|
| Teto de 30 itens e dedupe com reconstrução do índice | `hooks/useChat.ts:14,33-37` |
| `useChat` no nível da sala (origem da cascata) | `components/room/RoomExperience.tsx:135` |
| `formatTime` com `toLocaleTimeString` por item, por render | `components/room/Chat.tsx:7-9,92` |
| Envio sem `shouldQueueEventIfNotReady` | `hooks/useChat.ts:68` |
| Join **com** a flag (o caminho que já funciona) | `hooks/useRoomJoinAnnouncement.ts:26` |
| Truncamento silencioso em 500 caracteres | `hooks/useChat.ts:63` |
| Emoji concatena no fim do draft | `components/room/Chat.tsx:126` |
| Autor e horário repetidos em toda linha | `components/room/Chat.tsx:90-99` |
| Ponto idêntico para todo participante | `components/room/PresenceList.tsx:51,60` |
| Barra de rolagem escondida em toda a aplicação | `app/globals.css:150-161` |
| Monocromia: estado por contraste/inversão/peso, nunca matiz | `app/globals.css:4-27` |
| Coluna da sala com no mínimo 288px | `components/room/RoomExperience.tsx:704` |
| Altura do vídeo depende de `22rem` literal | `components/room/RoomExperience.tsx:518-523` |
| Handlers de player já ignoram `TEXTAREA` | `components/room/RoomExperience.tsx:328-338` |

## 4. Alternativas consideradas e descartadas

| Alternativa | Motivo da descarte |
|---|---|
| `React.memo` em `Chat` e `PresenceList` sozinho | Resolve o sintoma e não a causa: com `useChat` no nível da sala, o estado muda acima dos dois e os dois re-renderizam de todo jeito. Fica como defesa em profundidade (FR-010, ondas 1 e 2), não como o isolamento (FR-002). |
| Context com a store criada por sala | Correto e mais limpo, mas exige um provider novo em volta da árvore e muda a assinatura de três componentes. O singleton de módulo com reset no ciclo de vida da sala é o mesmo padrão já usado e testado em `hooks/usePlaybackClock.ts`; a janela de vazamento é a mesma que o clock já tem. |
| Sorteira local a cada tecla | Descartada: um valor novo por tecla re-renderiza a lista inteira, exatamente o oposto do objetivo. O isolamento tem que vir do estado, não de efeito colateral. |
| Aumentar o teto de 30 e virtualizar | Contradiz a decisão de histórico efêmero (spec 01, seção 2) e, com 30 itens, não há ganho. |
| `content-visibility: auto` no item | Efeito colateral imprevisível em `jsdom`/Safari e sem ganho mensurável em 30 itens. |
| Ordenar o feed só no envio, não na inserção | Não cobre a fila de reconexão (FR-005), que é justamente onde a ordem se perde. |
| Escurecer a mensagem própria com `--bg-surface` | Invisível: o log e o painel de teatro já são `--bg-surface`. A inversão (`--invert-bg`) é o mecanismo que o projeto já usa para estado ativo (`app/globals.css:25-26`). |
| Avatar com cor por participante | Viola a direção visual monocromática (`app/globals.css:4-5`). Diferenciação por forma (iniciais) e por peso (quatro tons). |
| Recuo do `visualViewport` para o teclado virtual | Trocaria um defeito pequeno (campo fora da vista ao focar) por risco de o campo sair da caixa num caminho sem device de teste. Fica registrado como divergência da spec 13, seção 8. |
| Busca no histórico / prévia de link | Dependem de histórico persistente (não existe) e de proxy externo (SSRF), respectivamente. Não-objetivos. |

## 5. Referência externa: Kosmi

Kosmi (`kosmi.io`) vende a sala como produto social completo: voz e vídeo integrados, reação
"em voz alta" em vez de caixa de texto, salas com avatares, screen share e convidado sem cadastro.
Voz, reação e convidado sem cadastro foram **descartados por decisão de produto** em 2026-10-03 — o
que sobra da referência, e é o que esta spec entrega, é a parte de texto: envio confiável, custo por
tecla e leitura do log.

## 6. O que não foi medido

- Custo absoluto em ms, em navegador: não medido (jsdom não serve).
- Contagem de renders com `StrictMode` ligado: o projeto não usa `StrictMode`; com ele, os números
  dobram e a leitura por contador passa a exigir `act` por evento.
- Comportamento com três ou mais participantes simultâneos e presença mexendo junto com chat: não
  medido.