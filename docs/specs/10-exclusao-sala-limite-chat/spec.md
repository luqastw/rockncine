# Spec: exclusão de sala pelo dono e limite de histórico do chat

**Status:** especificado — implementação não iniciada
**Artefatos irmãos:** `plan.md`, `research.md`, `data-model.md`, `contracts/delete-room.md`, `tasks.md`

---

## 1. Problema / motivação

Quem cria uma sala em `/rooms` não tem como apagá-la. Hoje cada acesso a uma sala grava uma linha
em `RoomMember` (`app/rooms/[code]/layout.tsx`), e essa lista é a única forma de reencontrar a
sala. O efeito é que salas criadas por engano, para teste, ou já sem uso ficam na lista para
sempre — sem que o dono possa removê-las. Não há exclusão de sala em nenhum ponto da aplicação:
nem endpoint, nem botão, nem script.

Em paralelo, o feed do chat de uma sala retém até 200 itens em estado React
(`hooks/useChat.ts`), e o índice de ids usados para deduplicação acompanha essa retenção. Salas
longas com conversa ativa acumulam esse histórico durante toda a sessão, sem que ninguém possa
descartá-lo — e o custo de manter e re-renderizar a lista cresce junto, o que já produziu
travamento perceptível em salas com muitas mensagens.

## 2. Objetivos e não-objetivos

**Objetivos**

1. Permitir que o dono de uma sala a exclua a partir da lista em `/rooms`, com confirmação
   explícita antes da ação irreversível.
2. Impedir que qualquer pessoa que não seja o dono exclua a sala, com a checagem feita no
   servidor.
3. Reduzir o histórico retido no feed do chat de uma sala para 30 itens.

**Não-objetivos (fora do escopo)**

- Transferir propriedade da sala antes de excluir.
- Excluir a sala correspondente no Liveblocks — a sala de lá é efêmera e o código de convite é
  aleatório (`lib/room-code.ts`), sem reúso previsto.
- Arquivar, restaurar ou desfazer a exclusão; não haverá lixeira nem soft delete.
- Notificar os demais participantes de que a sala foi excluída.
- Excluir a sala de dentro da própria sala (o único ponto de entrada é a lista em `/rooms`).
- Apagar dados locais do navegador associados à sala (histórico de chat é volátil por decisão,
  e as preferências de qualidade são globais, não por sala).
- Qualquer mudança no mecanismo de sincronização de vídeo.
- Extração ampla de componentes de UI (`components/ui`) — fora deste escopo, fica para o redesign.

## 3. Histórias de usuário

- **US-1**: Como dono de uma sala, quero excluí-la a partir da minha lista, para tirar da lista as
  salas que criei por engano ou que já não uso.
- **US-2**: Como dono de uma sala, quero confirmar a exclusão antes que ela aconteça, para não
  apagar uma sala com um clique acidental.
- **US-3**: Como participante de uma sala criada por outra pessoa, quero ter certeza de que não
  consigo apagá-la, para não derrubar a watch-party dos outros.
- **US-4**: Como participante de uma sala com conversa longa, quero que o histórico do chat fique
  limitado, para que a sala continue utilizável depois de muitas mensagens.

## 4. Requisitos funcionais (EARS)

### Exclusão de sala

- **FR-001** O sistema DEVE exibir, em cada item de `/rooms` cujo `ownerId` seja o do usuário
  autenticado, um botão com o texto "excluir sala" posicionado à direita do item.
- **FR-002** O sistema NÃO DEVE exibir botão de exclusão em item de sala cujo `ownerId` seja
  diferente do usuário autenticado.
- **FR-003** QUANDO o usuário acionar o botão de exclusão, o sistema DEVE abrir um modal que exiba
  o nome e o código da sala e ofereça as ações "cancelar" e "excluir sala".
- **FR-004** QUANDO o usuário acionar "excluir sala" no modal, o sistema DEVE enviar
  `DELETE /api/rooms/{code}` e desabilitar as duas ações até receber a resposta.
- **FR-005** QUANDO a requisição retornar `200`, o sistema DEVE fechar o modal e remover o item da
  lista exibida.
- **FR-006** SE a requisição falhar por erro de rede ou retornar status diferente de `200` e `404`,
  ENTÃO o sistema DEVE manter o modal aberto, manter o item na lista e exibir a mensagem do campo
  `error` da resposta em um elemento com `role="alert"`.
- **FR-007** SE a requisição retornar `404`, ENTÃO o sistema DEVE tratar a sala como já removida:
  fechar o modal e remover o item da lista, sem exibir erro.
- **FR-008** SE o solicitante não estiver autenticado, ENTÃO o servidor DEVE responder `401` com
  corpo `{ error: string }` sem alterar nenhuma linha de `Room` ou `RoomMember`.
- **FR-009** SE o solicitante estiver autenticado e não for o dono da sala, ENTÃO o servidor DEVE
  responder `403` com corpo `{ error: string }` sem alterar nenhuma linha de `Room` ou
  `RoomMember`.
- **FR-010** SE a sala não existir, ENTÃO o servidor DEVE responder `404` com corpo
  `{ error: string }`.
- **FR-011** SE o cabeçalho `Origin` estiver presente e o host dele divergir do host da requisição,
  ENTÃO o servidor DEVE responder `403` sem alterar nenhuma linha de `Room` ou `RoomMember`.
- **FR-012** QUANDO o dono solicitar a exclusão de uma sala existente, o servidor DEVE remover
  todas as `RoomMember` daquela sala e o registro `Room` em uma única transação, respondendo `200`
  com corpo `{ ok: true }`.
- **FR-013** ENQUANTO o modal de confirmação estiver aberto, o sistema DEVE manter o foco do
  teclado dentro do painel do modal.
- **FR-014** QUANDO o modal estiver aberto e a tecla Escape for pressionada ou o usuário clicar no
  overlay, o sistema DEVE fechar o modal e devolver o foco ao botão que o abriu.

### Histórico do chat

- **FR-015** O sistema DEVE reter no máximo 30 itens no feed do chat de uma sala, descartando os
  mais antigos quando o limite for excedido.
- **FR-016** O sistema DEVE manter o conjunto de ids usados para deduplicar o chat com no máximo
  30 entradas.
- **FR-017** O sistema DEVE contar mensagens de chat e mensagens de sistema no mesmo limite de 30
  itens.
- **FR-018** QUANDO um item for descartado pelo limite, o sistema DEVE reconstruir o conjunto de
  ids a partir dos itens retidos, de modo que um id descartado possa voltar a ser aceito.

## 5. Critérios de aceite (Given-When-Then)

Um `When` por cenário; todo `Then` é observável.

### Autorização e contrato do endpoint

- **AC-001** [FR-008] Given nenhuma sessão autenticada, When `DELETE /api/rooms/{code}` para uma
  sala existente, Then a resposta é `401`, o corpo tem `error` como string não vazia, e a contagem
  de linhas de `Room` e de `RoomMember` com aquele código é igual à de antes.
- **AC-002** [FR-009] Given sessão autenticada de um usuário que não é o dono, When
  `DELETE /api/rooms/{code}`, Then a resposta é `403` e a sala continua existindo.
- **AC-003** [FR-009] Given sessão autenticada de um usuário que não é o dono mas é `RoomMember`
  da sala, When `DELETE /api/rooms/{code}`, Then a resposta é `403` e a membership daquele usuário
  continua existindo.
- **AC-004** [FR-010] Given sessão autenticada, When `DELETE /api/rooms/{code}` com código que não
  existe, Then a resposta é `404`.
- **AC-005** [FR-011] Given sessão autenticada do dono, When `DELETE /api/rooms/{code}` com
  `Origin: https://exemplo.invalido`, Then a resposta é `403` e a sala continua existindo.
- **AC-006** [FR-012] Given sessão autenticada do dono e uma sala com 3 `RoomMember`, When
  `DELETE /api/rooms/{code}`, Then a resposta é `200` com `{ ok: true }`, a contagem de linhas de
  `RoomMember` com aquele `roomId` é 0 e a linha de `Room` não existe mais.
- **AC-007** [FR-012] Given uma sala já excluída com sucesso, When `DELETE /api/rooms/{code}` é
  repetido com a mesma sessão do dono, Then a resposta é `404`.

### Interface da lista

- **AC-008** [FR-001, FR-002] Given `/rooms` com uma sala cujo `ownerId` é o do usuário e outra
  cujo `ownerId` é de terceiro, When a página é renderizada, Then existe exatamente um elemento com
  o texto "excluir sala" e ele está dentro do item da sala do usuário.
- **AC-009** [FR-003] Given o botão de exclusão visível, When ele é acionado, Then existe um
  elemento com `role="dialog"` e `aria-modal="true"` contendo o nome da sala, o código da sala e os
  textos "cancelar" e "excluir sala", e `document.activeElement` está contido no painel do modal.
- **AC-010** [FR-014] Given o modal aberto, When Escape é pressionado, Then o painel deixa de
  existir no DOM e `document.activeElement` é o botão que abriu o modal.
- **AC-011** [FR-006] Given o modal aberto e o endpoint respondendo `403` com
  `{ error: "não é o dono desta sala." }`, When a resposta chega, Then o painel continua no DOM, o
  item continua na lista e existe um elemento com `role="alert"` cujo texto é
  "não é o dono desta sala.".
- **AC-012** [FR-004] Given o modal aberto e a resposta ainda não recebida, When "excluir sala" é
  acionado, Then os dois botões do modal estão com `disabled`.
- **AC-013** [FR-007] Given o modal aberto e o endpoint respondendo `404`, When a resposta chega,
  Then o painel deixa de existir no DOM e o item sai da lista sem elemento com `role="alert"`.
- **AC-019** [FR-005] Given o modal aberto e o endpoint respondendo `200`, When a resposta chega,
  Then o painel deixa de existir no DOM e o item daquela sala não é mais encontrado na lista
  (reexibida a partir do servidor).

### Histórico do chat

- **AC-014** [FR-015] Given um feed vazio, When 40 itens distintos são anexados em sequência, Then
  o feed contém 30 itens e o primeiro item é o 11º anexado.
- **AC-015** [FR-017] Given 5 mensagens de sistema e 35 mensagens de chat intercaladas, When o
  limite é atingido, Then a soma de itens no feed é 30.
- **AC-016** [FR-018] Given o feed no limite, When um id que já foi descartado é anexado de novo,
  Then esse id passa a constar no feed.
- **AC-017** [FR-016] Given 40 itens distintos anexados, When o limite descarta 10, Then o conjunto
  de ids vistos tem exatamente 30 entradas.
- **AC-018** [FR-015, FR-018] Given o feed no limite, When um id que consta no feed é anexado de
  novo, Then o feed continua com 30 itens e nenhuma duplicata é inserida.

## 6. Requisitos não-funcionais (quantificados)

- **Segurança:** o endpoint `DELETE /api/rooms/[code]` exige sessão válida e confere a propriedade
  da sala no servidor antes de qualquer escrita; aceita apenas o método `DELETE`. O corpo de erro
  contém somente `{ error: string }`, sem nome, dono ou qualquer outro dado da sala.
- **Performance:** no máximo 3 instruções ao banco por requisição — 1 `SELECT` da sala e os 2
  `DELETE` da transação. Verificação: leitura do código na revisão.
- **Memória:** o feed do chat retém no máximo 30 itens e o conjunto de ids no máximo 30 entradas,
  verificado por teste unitário (AC-014, AC-017).
- **Acessibilidade:** o modal expõe `role="dialog"`, `aria-modal="true"` e `aria-labelledby`
  apontando para o título; fecha com Escape e com clique no overlay; mantém o ciclo de Tab dentro
  do painel; devolve o foco ao gatilho. Verificação: asserções em teste (AC-009, AC-010) somadas à
  verificação manual nomeada descrita em `tasks.md`.

## 7. Dados e contratos

- Nenhuma entidade nova, nenhum campo novo, nenhuma migração de schema. A exclusão remove linhas
  existentes em `Room` e `RoomMember`. Detalhes em `data-model.md`.
- Contrato completo do endpoint em `contracts/delete-room.md`.
- A interface do feed do chat não muda: `useChat` continua devolvendo
  `{ messages, sendMessage, appendMessage }`; muda apenas o teto de retenção.

## 8. Riscos / dependências / perguntas abertas

- **Dependência de migration não aplicada.** A migration
  `20260918230000_room_member_index_and_fk_actions` (que adiciona `ON DELETE CASCADE` em
  `RoomMember` e o índice de `userId`) está no repositório e **não foi aplicada** no banco. Por
  isso FR-012 exige remoção explícita das memberships na transação: a rota funciona com o FK atual
  (`NO ACTION`). O índice continua valendo só depois de `npx prisma migrate deploy`.
- **Pergunta aberta.** FR-017 fixa que mensagens de sistema (entrada/saída de participante)
  consomem o mesmo orçamento de 30 das mensagens de chat. Se a intenção for manter 30 mensagens de
  chat independentemente das de sistema, este requisito precisa mudar e AC-015 precisa ser
  reescrito antes da implementação.
- **Risco de arquivo de teste no diretório de rotas.** O teste da rota fica colocado junto
  (`app/api/rooms/[code]/route.test.ts`), seguindo a convenção do repositório. Se o `next build`
  recusar arquivos não-convencionais em `app/`, o teste migra para um diretório de testes fora de
  `app/`. Verificação: `next build` do gate.
- **Risco de concorrência.** Duas exclusões simultâneas da mesma sala produzem um `200` e um
  `404`; AC-007 cobre a segunda chamada. Não há requisito de serialização além disso.
