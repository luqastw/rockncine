# Tasks — identidade Kimi Platform

| ID | Tarefa | Requisitos | Prova |
|---|---|---|---|
| T-001 | Substituir tokens, escala tipográfica, raios e sombras em `app/globals.css`; remover grão/ASCII | FR-001, FR-002, FR-004 | `identity.test.ts`, `styles.test.ts` |
| T-002 | Trocar fontes para Geist/Geist Mono em `layout.tsx` e `global-error.tsx` | FR-003 | `AC-003`, build |
| T-003 | Criar `AmbientGlow`, `Wordmark`, `PageShell` e `ChromeBar` com blur/fio no scroll | FR-005, FR-006, FR-007 | `a11y.test.tsx`, `styles.test.ts`, browser |
| T-004 | Criar `lib/cx.ts` e `components/ui/*`; migrar formulários e diálogos | FR-008 | `surfaces.test.tsx`, `states.test.tsx` |
| T-005 | Redesenhar landing, auth, `/rooms` e estados | FR-004, FR-008 | screenshots 390/768/1440 |
| T-006 | Aplicar a linguagem à sala (player, chat, presença, ações, transmissão) | FR-009, FR-010 | `Chat.test.tsx`, browser |
| T-007 | Atualizar specs/README e rodar o gate | AC-011 | `npm run gate` |
| T-008 | Auditoria manual de contraste, 320px, 200% e reduced motion/transparency | AC-012 | screenshots/medições |
