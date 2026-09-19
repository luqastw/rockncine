# Spec: achados pós-deploy

**Status:** implementado (com ressalvas) — 6 dos 7 achados implementados (14.1–14.4, 14.6, 14.7); o item 14.5 (código de sala de 8 → 4 caracteres) segue pendente.
**Pesquisa:** `research.md`

## 1. Problema / motivação

Rodada de sete pedidos concretos levados por teste manual do usuário em produção. Os pedidos cobrem:
o log do chat estica a página em telas largas fora de tela cheia; não há mensagem de chat quando
alguém sai da sala; o cadastro aceita e-mail malformado; a lista de presença fica sempre aberta; o
código de sala de 8 caracteres é difícil de ditar; o modal de "carregar vídeo" não aparece em tela
cheia nativa; e as legendas do YouTube iniciam ligadas.

O diagnóstico completo de cada item — medições, vereditos e código citado por linha — está em
`research.md`; este documento fica com o contrato.

## 2. Objetivos e não-objetivos

**Objetivos**

1. Conter a lista de mensagens do chat em uma altura fixa em todos os breakpoints, com rolagem interna.
2. Anunciar no chat a saída de um participante, sem duplicar mensagens em reconexões.
3. Recusar no servidor e-mails que não tenham formato válido.
4. Mostrar a presença colapsada, com a contagem visível e a lista de nomes sob clique.
5. Reduzir o código de sala gerado de 8 para 4 caracteres.
6. Fazer o modal de "carregar vídeo" aparecer em tela cheia nativa.
7. Manter as legendas do YouTube desligadas por padrão.

**Não-objetivos (fora do escopo)**

- Implementar protocolo de heartbeat próprio no client para acelerar a detecção de queda abrupta de
  conexão (14.2): `useOthers()` já responde "quem está online"; o único gap acionável é a mensagem de
  saída.
- Implementar validação de e-mail segundo a RFC 5322 completa (14.3); basta um formato prático.
- Aplicar o regex de e-mail no login (14.3) — no login a consulta é lookup, não criação.
- Introduzir portal ou dependência nova para posicionar o modal (14.6).
- Migrar o schema de `Room.code` (14.5) — a coluna é `String` livre, sem `VarChar(n)`.
- Alterar o restante do chat, da presença ou do layout além do que cada achado descreve.

## 3. Histórias de usuário

- **US-1** (14.1): Como participante fora de tela cheia em tela larga, quero que a lista do chat role
  dentro de um quadro fixo, para que a página não estique a cada mensagem recebida.
- **US-2** (14.2): Como participante, quero ver no chat uma mensagem quando alguém sai da sala, para
  não ter que procurar quem sumiu na lista de presença.
- **US-3** (14.3): Como operador da plataforma, quero que o cadastro recuse e-mails malformados, para
  não gravar contas com endereço inválido.
- **US-4** (14.4): Como participante, quero ver só a contagem de pessoas conectadas e expandir a
  lista ao clicar, para reduzir o espaço ocupado pela presença.
- **US-5** (14.5): Como quem cria uma sala, quero um código mais curto, para ditar aos amigos sem erro.
- **US-6** (14.6): Como participante em tela cheia nativa, quero que o modal de "carregar vídeo"
  apareça, para trocar o vídeo sem sair da tela cheia.
- **US-7** (14.7): Como espectador, quero que as legendas do YouTube comecem desligadas, para assistir
  sem sobreposição de texto.

## 4. Requisitos funcionais (EARS)

### 14.1 — Altura do chat
- **FR-001** O sistema DEVE fixar a altura do contêiner principal da sala (`main`) em `100dvh` com
  `overflow: hidden` em todos os breakpoints, inclusive `lg+`, de modo que o log do chat (`<ul>` com
  `overflow-y-auto`) receba uma caixa fechada onde rolar.
- **FR-002** O sistema DEVE preservar, em qualquer breakpoint, o respiro inferior entre o palco e o
  badge de presença do Liveblocks.
- **FR-003** QUANDO o chat estiver em tela cheia — nativa ou fallback `cssFullscreen` —, o sistema
  DEVE conter a lista de mensagens na altura da viewport, com rolagem interna.

### 14.2 — Anúncio de saída
- **FR-004** QUANDO a última conexão de um participante deixar a sala, o sistema DEVE adicionar ao
  feed local do chat uma mensagem de sistema `"{nome} saiu da sala"`.
- **FR-005** O sistema DEVE detectar a saída localmente, em cada cliente já conectado, sem broadcast
  aos demais clientes.
- **FR-006** SE o mesmo `userId` reentrar antes de decorrida a janela anti-flicker, ENTÃO o sistema
  NÃO DEVE emitir a mensagem de saída.
- **FR-007** SE ainda houver outra conexão ativa do mesmo `userId`, ENTÃO o sistema NÃO DEVE emitir a
  mensagem de saída.
- **FR-008** O sistema NÃO DEVE emitir a mensagem de saída relativa ao usuário local.
- **FR-009** O sistema DEVE hospedar o detector de saída no mesmo nível de `RoomExperience`, nunca
  dentro de `Chat`, para que um remount por toggle de tela cheia ou teatro não reprocese o histórico
  de presence.

### 14.3 — Formato de e-mail
- **FR-010** QUANDO uma requisição de cadastro chegar, SE o campo `email` não satisfizer o formato
  (sem espaço, com um `@` e com domínio contendo ao menos um `.`), ENTÃO o servidor DEVE responder
  `400` com a mensagem de e-mail em minúsculas já usada e NÃO DEVE criar nenhuma linha de `User`.

### 14.4 — Presença colapsável
- **FR-011** O sistema DEVE renderizar o cabeçalho de presença como um botão-resumo que exibe apenas a
  contagem de pessoas ("N na sala") no estado fechado, que é o padrão.
- **FR-012** QUANDO o botão-resumo for acionado, o sistema DEVE alternar a lista completa de nomes
  entre visível e oculta.
- **FR-013** O botão-resumo DEVE expor `aria-expanded` refletindo o estado e `aria-controls` apontando
  para a lista.
- **FR-014** O sistema DEVE exibir no botão-resumo um chevron da mesma família de ícones SVG já usada
  no player, que gira 180° no estado aberto.
- **FR-015** ENQUANTO a lista estiver expandida, o sistema DEVE exibir os participantes deduplicados
  por `userId`, com o ponto de presença e a marcação "(você)" para o usuário local.

### 14.5 — Código da sala
- **FR-016** O sistema DEVE gerar códigos de sala com exatamente 4 caracteres.
- **FR-017** O sistema DEVE manter o alfabeto de geração restrito a letras maiúsculas e dígitos,
  excluindo `0`, `O`, `1`, `I`, `L` e `U`.

### 14.6 — Modal de "carregar vídeo" em tela cheia
- **FR-018** O sistema DEVE renderizar o `<LoadVideoModal>` dentro da subárvore do elemento que entra
  em tela cheia (`stageRef`), e não como irmão dela.
- **FR-019** QUANDO a tela cheia nativa estiver ativa e o usuário acionar "carregar vídeo", o sistema
  DEVE tornar o modal visível na árvore renderizada da tela cheia.
- **FR-020** O sistema NÃO DEVE introduzir portal nem dependência nova para posicionar o modal.

### 14.7 — Legendas do YouTube
- **FR-021** QUANDO um vídeo do YouTube for carregado, o sistema DEVE manter as legendas desativadas.
- **FR-022** O sistema DEVE declarar `cc_load_policy: 0` nos `playerVars` do player do YouTube.

## 5. Critérios de aceite (Given-When-Then)

Um `When` por cenário; todo `Then` é observável.

### Formato de e-mail (14.3)
- **AC-001** [FR-010] Given uma requisição de cadastro com `email` = `"a@"`, When `POST /api/register`,
  Then a resposta é `400`, o corpo tem `error` com a mensagem de e-mail em minúsculas e a contagem de
  linhas de `User` é igual à de antes.
- **AC-002** [FR-010] Given `email` = `"@@"`, When `POST /api/register`, Then a resposta é `400`.
- **AC-003** [FR-010] Given `email` = `"x@y"` (domínio sem ponto), When `POST /api/register`, Then a
  resposta é `400`.
- **AC-004** [FR-010] Given `email` = `"a@b.co"`, When `POST /api/register`, Then a resposta não é a
  mensagem de e-mail inválido (o formato passa).

### Anúncio de saída (14.2)
- **AC-005** [FR-006] Given um participante que sai e reentra dentro da janela anti-flicker, When os
  eventos `leave` e `enter` do mesmo `userId` são processados, Then nenhuma mensagem de sistema
  contendo "saiu da sala" é adicionada ao feed.
- **AC-006** [FR-004] Given um participante que fecha a conexão e não reentra, When a janela
  anti-flicker transcorre, Then o feed local contém exatamente uma mensagem de sistema
  `"{nome} saiu da sala"`.
- **AC-007** [FR-007] Given a mesma pessoa com duas conexões ativas e uma delas fecha, When o evento
  `leave` é processado, Then nenhuma mensagem de saída é adicionada.
- **AC-008** [FR-005] Given N clientes conectados e um participante que sai, When a saída é detectada,
  Then a mensagem entra só no feed local de cada cliente, sem broadcast de saída.
- **AC-009** [FR-008] Given o próprio usuário local, When um evento `leave` do seu `userId` é
  processado, Then nenhuma mensagem de saída é adicionada.
- **AC-010** [FR-009] Given um toggle de tela cheia/teatro que desmonta e remonta o componente do
  chat, When o detector de saída permanece montado em `RoomExperience`, Then nenhum histórico de
  presence é reprocessado e nenhuma mensagem de saída espúria é gerada.

### Altura do chat (14.1)
- **AC-011** [FR-001, FR-002] Given viewport `lg+` fora de tela cheia, When cerca de 20 mensagens
  curtas são anexadas, Then `scrollHeight` da página é ≤ `innerHeight`, o `<ul>` do chat tem
  `scrollHeight > clientHeight` (rola internamente) e o respiro inferior do badge é preservado.
- **AC-012** [FR-003] Given tela cheia nativa ativa, When cerca de 20 mensagens curtas são anexadas,
  Then a lista do chat rola internamente sem empurrar o palco para fora da viewport.
- **AC-013** [FR-003] Given o fallback `cssFullscreen` ativo, When cerca de 20 mensagens curtas são
  anexadas, Then a lista do chat rola internamente sem esticar a página.

### Presença colapsável (14.4)
- **AC-014** [FR-011, FR-013] Given a presença no estado padrão, When o cabeçalho é renderizado, Then
  existe um único `button` com texto "N na sala", `aria-expanded="false"`, `aria-controls` apontando
  para a lista, e as `<li>` de nomes não estão no DOM.
- **AC-015** [FR-012] Given a lista recolhida, When o botão-resumo é acionado, Then `aria-expanded`
  passa a `"true"` e as `<li>` de nomes entram no DOM.
- **AC-016** [FR-012] Given a lista expandida, When o botão-resumo é acionado, Then `aria-expanded`
  volta a `"false"` e as `<li>` de nomes saem do DOM.
- **AC-017** [FR-014] Given a lista expandida, When o botão-resumo é renderizado, Then o chevron
  carrega a classe de rotação de 180°.
- **AC-018** [FR-015] Given duas conexões da mesma pessoa e uma terceira pessoa, When a lista é
  expandida, Then a pessoa aparece uma única vez (dedupe por `userId`) e o usuário local aparece com a
  marcação "(você)".

### Código da sala (14.5)
- **AC-019** [FR-016, FR-017] Given a criação de uma sala, When o código é gerado, Then ele tem
  exatamente 4 caracteres e usa somente caracteres maiúsculos ou dígitos sem ambíguos.

### Modal em tela cheia (14.6)
- **AC-020** [FR-018, FR-019] Given tela cheia nativa ativa com o `stageRef` em
  `document.fullscreenElement`, When "carregar vídeo" é acionado, Then existe um elemento com
  `role="dialog"` dentro da subárvore de `document.fullscreenElement`.

### Legendas do YouTube (14.7)
- **AC-021** [FR-021, FR-022] Given um vídeo do YouTube cuja preferência do usuário iniciaria com
  legendas ligadas, When o player termina de inicializar, Then as legendas estão desativadas e
  `playerVars` contém `cc_load_policy: 0`.

## 6. Requisitos não-funcionais (quantificados)

- **Área de toque (14.4):** o botão-resumo de presença mede no mínimo 44 px.
- **Anti-flicker (14.2):** a janela que segura o `leave` é de 4000 ms; um `enter` dentro dela cancela
  a emissão.
- **Geração de código (14.5):** alfabeto de 30 símbolos, o que dá 30⁴ = 810 000 códigos; o
  retry-on-collision existente faz 5 tentativas antes de cair no `cuid()` de fallback.
- **Legendas (14.7):** `playerVars` do YouTube com 6 chaves, incluindo `cc_load_policy: 0`.
- **Gate de qualidade (14.8):** 0 erros em `npm test`, `npx tsc --noEmit`, `npx eslint` e
  `npx next build` antes de declarar qualquer item concluído.
- **Verificação em navegador (14.8):** 3 casos de reprodução real — fora de tela cheia, tela cheia
  nativa e fallback `cssFullscreen` — obrigatórios para os itens 14.1 e 14.6.

## 7. Dados e contratos

- Nenhuma migração de schema. `Room.code` continua `String` `@unique` com `@default(cuid())`; códigos
  de 8 caracteres já emitidos permanecem válidos.
- Contrato do endpoint `POST /api/register`: a validação de formato passa a usar regex, sem mudar o
  formato do corpo de erro (`{ error: string }`, texto em minúsculas).
- O feed do chat ganha uma nova origem de item `SYSTEM_MESSAGE` `"{nome} saiu da sala"`, produzida só
  no feed local; a interface de `useChat` (append por item) não muda.
- `PresenceList` passa a ter estado de expansão local; nenhum contrato externo de props muda.
- `RoomExperience` muda a altura do `main` e a posição do `<LoadVideoModal>` na árvore; nenhuma prop
  pública muda.

## 8. Riscos / dependências / divergências

- **Divergência de status (2026-09-18).** O `spec.md` original declarava "pendente — implementação não
  iniciada", mas os itens 14.1, 14.2, 14.3, 14.4, 14.6 e 14.7 estão implementados no código; só o
  14.5 segue aberto (`lib/room-code.ts` mantém `CODE_LENGTH = 8`, e `lib/room-code.test.ts` ainda
  afirma `toHaveLength(8)`).
- **Dependência do Liveblocks (14.2).** Não há heartbeat próprio; a janela real de detecção de queda
  abrupta depende do timeout interno do Liveblocks — fora de escopo. Só a mensagem de saída é
  acionável.
- **Risco de colisão (14.5).** Com 4 caracteres, o espaço cai para 810 000 códigos; em escala de
  dezenas de milhares de salas simultâneas, colisões deixam de ser raras. O retry cobre a geração, mas
  o produto deve monitorar.
- **Dependência da API do YouTube (14.7).** `cc_load_policy: 0`, sozinho, cai em "preferência do
  usuário"; a implementação também descarrega o módulo `captions` via `onApiChange`.
- **Risco de posicionamento (14.6).** O modal depende de `position: fixed` continuar resolvendo contra
  a viewport dentro da árvore do palco; os 3 casos de exibição precisam ser reproduzidos.

## Anexo A — numeração legada (âncoras citadas pelo código)

| Âncora antiga | O que dizia | Onde vive agora |
|---|---|---|
| 14.1 | chat sem teto de altura fora de tela cheia | FR-001–FR-003 / AC-011–AC-013 |
| 14.2 | presença ao fechar navegador + mensagem de saída | FR-004–FR-009 / AC-005–AC-010 |
| 14.3 | verificação de formato de e-mail | FR-010 / AC-001–AC-004 |
| 14.4 | presença colapsável (contagem + detalhe sob clique) | FR-011–FR-015 / AC-014–AC-018 |
| 14.5 | código da sala de 8 → 4 caracteres | FR-016–FR-017 / AC-019 (pendente) |
| 14.6 | modal de "carregar vídeo" em tela cheia | FR-018–FR-020 / AC-020 |
| 14.7 | legendas do YouTube desligadas por padrão | FR-021–FR-022 / AC-021 |
| 14.8 | verificação exigida ao implementar | NFR (gate + reprodução em navegador) |

Nenhuma destas âncoras é citada **por caminho** no código (`grep -rn "docs/specs/07" app components
hooks lib prisma` não retorna nada); a README de specs cita os números `14.x` desta tabela. O número
de item 14.x era a âncora estável desta spec — a numeração `FR-`/`AC-` nova é a substituta.
