# WORKLOG — wacrm

Entradas mais recentes no topo.

## 2026-09-30 — Fix: resposta (reply) estourando a caixa de diálogo no inbox

- **Problema:** quando o lead respondia uma mensagem, o balão com a citação ficava mais largo que a área de conversa e o texto era cortado na borda direita.
- **Causa:** `ReplyQuote` usa `truncate` (nowrap) e nenhum ancestral tinha `min-w-0`, então o conteúdo da citação alargava o balão além do `max-w-[75%]`.
- **Correção (só classes Tailwind):**
  - `src/components/inbox/message-actions.tsx`: wrapper com `min-w-0`.
  - `src/components/inbox/message-bubble.tsx`: coluna com `min-w-0`; balão com `min-w-0 max-w-full`.
  - `src/components/inbox/reply-quote.tsx`: citação com `min-w-0 overflow-hidden`.
- **Pendência:** validar visualmente no inbox com uma conversa que tenha reply longo.
