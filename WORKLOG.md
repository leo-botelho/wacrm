# WORKLOG — wacrm

Entradas mais recentes no topo.

## 2026-10-28 — Repositório passa a ser só do Borgo; FlowJob mudou para `leo-botelho/flowjob`

- O `.env.production` deste repositório foi alterado para o Supabase e o domínio do FlowJob e o build derrubou o CRM do Borgo. Rollback feito no Cloudflare da cliente.
- Este repositório foi revertido (commits de reversão) ao estado de `146d0e0`, o último deploy bom. **Não colocar aqui nada do FlowJob** (Tech Provider, rebrand, Graph v23, migration 013).
- Todo o trabalho do FlowJob (Embedded Signup, callbacks, rebrand, roadmap) está em `leo-botelho/flowjob`, pasta `D:epo-locallowjob`.

## 2026-09-30 — Fix: resposta (reply) estourando a caixa de diálogo no inbox

- **Problema:** quando o lead respondia uma mensagem, o balão com a citação ficava mais largo que a área de conversa e o texto era cortado na borda direita.
- **Causa:** `ReplyQuote` usa `truncate` (nowrap) e nenhum ancestral tinha `min-w-0`, então o conteúdo da citação alargava o balão além do `max-w-[75%]`.
- **Correção (só classes Tailwind):**
  - `src/components/inbox/message-actions.tsx`: wrapper com `min-w-0`.
  - `src/components/inbox/message-bubble.tsx`: coluna com `min-w-0`; balão com `min-w-0 max-w-full`.
  - `src/components/inbox/reply-quote.tsx`: citação com `min-w-0 overflow-hidden`.
- **Pendência:** validar visualmente no inbox com uma conversa que tenha reply longo.
