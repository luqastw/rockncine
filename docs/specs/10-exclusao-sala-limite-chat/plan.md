# Plano técnico — exclusão de sala e limite de chat

Spec: `spec.md` (nesta pasta). Todo item aqui referencia `FR-`/`AC-` do spec; nada de requisito novo.

## 1. Constitution check

Constitution do projeto = `AGENTS.md` (não existe `.specify/memory/constitution.md`).

| Regra | Status | Justificativa |
|---|---|---|
| Stack e linguagem (Next 16 App Router, React 19, TypeScript, Prisma) | ✅ | Route handler, server component e client component já existentes no repo; nenhuma tecnologia nova. |
| Política de dependência (não adicionar pacote sem perguntar) | ✅ | **Zero dependência nova.** Modal é próprio (`LoadVideoModal` é o precedente), o request usa `fetch` nativo, os testes usam o que já está instalado. |
| Testes: toda tarefa fecha com prova | ✅ | Testes unitários por tarefa + `npm run gate` no fim (Fase 4 do `sdd-implement`). |
| Acessibilidade | ✅ | Reusa o padrão de dialog já validado (`role`, `aria-modal`, trap de foco, Escape, clique-fora, retorno de foco). |
| Segurança | ✅ | Autorização no servidor; método `DELETE` (não enviável por `<form>`); checagem de `Origin`; corpo de erro sem dado da sala. |
| Estilo: tokens, pt-BR minúsculo, sem hex/px hardcoded | ✅ | Reusa as classes/tokens de `globals.css`; textos em minúsculo como o resto da UI. |
| `AGENTS.md` manda ler `node_modules/next/dist/docs/` antes de escrever código Next | ⚠️ | Pendência de execução: ler antes de tocar no route handler dinâmico e no metadata. |

Nenhuma violação bloqueante.

## 2. Decisão de arquitetura

### 2.1 A rota não confia no `ON DELETE CASCADE`

`FR-012` exige remover `RoomMember` e `Room` na mesma transação. A migration que adiciona
`ON DELETE CASCADE` existe no repositório mas **não foi aplicada** no banco, então o FK de hoje é
`NO ACTION` e um `prisma.room.delete()` cru falharia com violação de constraint. A rota executa:

```ts
await prisma.$transaction([
  prisma.roomMember.deleteMany({ where: { roomId: room.id } }),
  prisma.room.delete({ where: { id: room.id } }),
]);
```

Consequência: 2 instruções de escrita numa transação, e a feature funciona com ou sem a migration
aplicada.

**Alternativa rejeitada:** depender de `prisma.room.delete()` sozinho — ficaria quebrado (500 por
violação de FK) até o usuário rodar `migrate deploy`, que está fora do meu controle.

### 2.2 Um botão por linha, não a lista no cliente

`app/rooms/page.tsx` é server component e resolve as memberships no servidor. Extrair a lista
inteira para o cliente obrigaria a serializar `Room[]` e mover a leitura do banco para o browser.

**Decisão:** um client component por linha (`DeleteRoomButton`), recebendo apenas
`roomCode`/`roomName`. Cada instância guarda o próprio estado de modal e de requisição.

**Alternativa rejeitada:** lista inteira como client component — mais superfície serializada, mais
estado para o cliente, sem ganho.

### 2.3 Um `ConfirmDialog` genérico

O padrão de a11y do `LoadVideoModal` (overlay, `role="dialog"`, `aria-modal`, `aria-labelledby`,
trap de Tab, Escape, clique-fora, `triggerRef` para devolver o foco) tem ~80 linhas. Duplicá-lo
dentro do `DeleteRoomButton` cria um segundo lugar para o trap de foco divergir.

**Decisão:** extrair `components/ConfirmDialog.tsx` com esse padrão e usá-lo no botão de exclusão.
Escopo deliberadamente mínimo: **não** é a extração ampla de `components/ui` (TextField,
SubmitButton, useSubmit, useTimeout, StatusScreen) que segue adiada para o redesign.

**Alternativa rejeitada:** usar `window.confirm()` — não é estilizável, não tem o vocabulário
visual do app, não permite `role="alert"` para erro e não permite estado de "excluindo...".

### 2.4 Teto do chat é só uma constante

`FR-015`/`FR-016` já estão estruturalmente implementados: `useChat` corta com
`.slice(-MAX_MESSAGES)` e reconstrói `seenIdsRef` a partir dos itens retidos quando o corte
acontece. A mudança é `MAX_MESSAGES` de 200 para 30. Nenhuma reescrita do hook.

**Alternativa rejeitada:** criar um segundo limite só para mensagens de sistema — contraria
`FR-017`, que é a decisão registrada no spec (e está marcada lá como pergunta aberta).

### 2.5 Checagem de `Origin` sem allowlist configurável

`FR-011` compara o host do cabeçalho `Origin` com o host da requisição e recusa divergência.
Não há lista de origens permitidas em configuração: introduzir uma exigiria variável de ambiente
nova e um valor por ambiente (preview da Vercel, local, produção) — não pedido pelo spec.

**Alternativa rejeitada:** token CSRF explícito — o método `DELETE` já não é enviável por
`<form>` HTML, então o vetor clássico não se aplica; um token adicionaria estado de sessão sem
ameaça correspondente.

## 3. Arquivos

**Criar**

| Arquivo | Papel |
|---|---|
| `app/api/rooms/[code]/route.ts` | handler `DELETE` (FR-008..FR-012) |
| `app/api/rooms/[code]/route.test.ts` | testes do contrato (AC-001..AC-007) |
| `components/ConfirmDialog.tsx` | dialog de confirmação reutilizável (FR-003, FR-013, FR-014) |
| `components/ConfirmDialog.test.tsx` | testes de a11y do dialog (AC-009, AC-010) |
| `components/DeleteRoomButton.tsx` | botão + estado da requisição (FR-004..FR-007) |
| `hooks/useChat.test.ts` | testes do teto do feed (AC-014..AC-018) |

**Alterar**

| Arquivo | Mudança |
|---|---|
| `hooks/useChat.ts` | `MAX_MESSAGES` 200 → 30 |
| `app/rooms/page.tsx` | `<li>` vira linha flex; `DeleteRoomButton` só quando `room.ownerId === userId` |

**Nenhum arquivo de schema, migration ou configuração é tocado.**

## 4. Pontos de integração

- `app/rooms/page.tsx` já seleciona `ownerId` na query de memberships — a condição `FR-001` sai
  do dado que a página já tem, sem query nova.
- O botão nunca entra dentro do `<Link>` (interativo aninhado em interativo é HTML inválido): os
  dois são irmãos dentro do `<li>`.
- `ConfirmDialog` precisa receber `onClose` e `onConfirm` estáveis? Não — ele guarda a referência
  mais recente em ref, como o `LoadVideoModal` faz, justamente para não re-inscrever o listener de
  teclado a cada render do pai.
- O teste da rota importa `./route` por caminho relativo: o diretório chama-se `[code]` e o alias
  `@/` combinado com colchetes no caminho é risco desnecessário.

## 5. Dependências novas

Nenhuma.

## 6. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| `route.test.ts` dentro de `app/` incomodar o `next build` | `next build` faz parte do gate; se recusar, o teste move para fora de `app/` |
| `FR-017` (sistema conta no limite de 30) ser decisão errada | marcado como pergunta aberta no `spec.md`; AC-015 muda junto se o requisito mudar |
| Migration de índice/cascade pendente | a rota não depende dela (2.1); o índice segue pendente e está registrado no relatório |
