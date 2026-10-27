# WORKLOG — wacrm

Entradas mais recentes no topo.

## 2026-10-27 — Rebrand FlowJob, fase 1: logo e textos visíveis

- Logo FlowJob (monograma F em fluxo, roxo `#7c3aed`): `public/brand/flowjob-icon.svg` e `flowjob-icon-1024.png` (transparente, 20 KB, para o app Meta). `Logo`/`LogoMark` em `src/components/icons/logo.tsx` e favicon `src/app/icon.svg` trocados.
- "MetaZap CRM" → "FlowJob" em `layout.tsx` (título) e `sidebar.tsx`; nome aplicado nas páginas legais.
- **Não feito (depende de decisão):** nomes técnicos `wacrm` (`package.json`, `wrangler.jsonc`, `WACRM_API_KEY`, chave `wacrm.theme`, repositório) e itens fora do código (app Meta, domínio, e-mails do Supabase Auth). Ver `docs/ROADMAP.md` item 1.3/1.4.
- Migration `013_embedded_signup.sql` aplicada pela dona.

## 2026-10-27 — Roadmap criado: rebrand para FlowJob (nada implementado)

Criado `docs/ROADMAP.md` com o rebrand como item 1 (antes do App Review da Meta). Inventário feito: o nome visível hoje é "MetaZap CRM" (`layout.tsx`, `sidebar.tsx`, `logo.tsx`) e o nome técnico é `wacrm` (`package.json`, `wrangler.jsonc`, `WACRM_API_KEY`, chave `wacrm.theme` no localStorage, links do repositório de origem). Renomear o Worker e a variável `WACRM_API_KEY` tem impacto em deploy e integrações, então o roadmap prevê transição com as duas chaves. Logo ainda não foi criado.

## 2026-10-27 — Meta Tech Provider: Embedded Signup, callbacks e páginas legais

Preparação do app para virar Tech Provider (clientes conectam o número pelo fluxo oficial da Meta, sem colar token).

- **Migration `013_embedded_signup.sql`** (aplicar com `supabase db push`): `whatsapp_config` ganha `connection_type`, `meta_user_id`, `registration_pin` (cifrado); tabela `meta_data_deletion_requests`; função `whatsapp_phone_in_use` (um número só pode servir uma conta).
- **`POST /api/whatsapp/embedded-signup`**: troca o `code` por token, valida o número, assina o app no WABA (`subscribed_apps`), registra o número (best effort) e grava a config cifrada. Helpers novos em `meta-api.ts`.
- **UI**: botão "Conectar com Facebook" em Configurações → WhatsApp (`embedded-signup-button.tsx`). Só aparece com `NEXT_PUBLIC_META_APP_ID` e `NEXT_PUBLIC_META_ES_CONFIG_ID`; o formulário manual continua.
- **Callbacks da Meta**: `/api/meta/deauthorize` (apaga o token, status desconectado) e `/api/meta/data-deletion` (remove a config e devolve `url` + `confirmation_code`). Validam `signed_request` com HMAC (`signed-request.ts`, com testes).
- **Webhook**: GET aceita o token de verificação do app (`META_WEBHOOK_VERIFY_TOKEN`) além dos tokens por conta.
- **Páginas públicas** (rascunho, **revisar com jurídico e preencher os `[CAMPOS]`**): `/privacidade`, `/termos`, `/exclusao-de-dados`.
- **Graph API** de `v21.0` para `v23.0` (`meta-api.ts` e `templates/sync`).
- **Testes**: os 23 testes que falham (`encryption.test.ts`, `date-utils.test.ts`, `webhook-signature.test.ts`) já falhavam antes; não foram tocados.
- **Pendências (lado Meta)**: Business Verification, app Live, `config_id` do Embedded Signup, URLs de callback/webhook no painel, App Review com Advanced Access (`whatsapp_business_management` e `whatsapp_business_messaging`) + screencast, registro como Tech Provider. Env vars em `.env.local.example`.

## 2026-10-22 — Especificação: disparos externos do Smart Gest com status de entrega (nada implementado)

Escrito `docs/integracao-smartgest.md`. **Só documentação**: nenhum código, schema ou migration alterado.

O Smart Gest vai enviar prospecção pela Cloud API usando o mesmo número do wacrm. Ele registra cada envio
aqui como disparo externo (`broadcasts.source = 'smartgest'`), e o módulo Disparos passa a mostrar enviado,
entregue, lido, respondido e falhou. O wacrm devolve ao Smart Gest só os eventos desses destinatários, por
fila durável. Lido no código: status de mensagem fora de broadcast é descartado, e o erro do status (código
e motivo) não é gravado hoje.

O wacrm atende várias contas, então a integração é **por conta** (`smartgest_integrations`: chave, segredos
cifrados e URL de eventos próprios; a conta vem da chave assinada, nunca do corpo), **desligada por padrão** e
liberada por `profiles.beta_features` só na conta do dono. Outras contas não mudam nem veem nada.

Pontos em aberto na especificação: qual conta recebe o flag, etiquetas `prospeccao-smartgest` e
`nao-perturbe`, número exclusivo ou compartilhado, agendador do cron.

## 2026-09-30 — Fix: resposta (reply) estourando a caixa de diálogo no inbox

- **Problema:** quando o lead respondia uma mensagem, o balão com a citação ficava mais largo que a área de conversa e o texto era cortado na borda direita.
- **Causa:** `ReplyQuote` usa `truncate` (nowrap) e nenhum ancestral tinha `min-w-0`, então o conteúdo da citação alargava o balão além do `max-w-[75%]`.
- **Correção (só classes Tailwind):**
  - `src/components/inbox/message-actions.tsx`: wrapper com `min-w-0`.
  - `src/components/inbox/message-bubble.tsx`: coluna com `min-w-0`; balão com `min-w-0 max-w-full`.
  - `src/components/inbox/reply-quote.tsx`: citação com `min-w-0 overflow-hidden`.
- **Pendência:** validar visualmente no inbox com uma conversa que tenha reply longo.
