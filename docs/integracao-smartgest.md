# Integração wacrm ↔ Smart Gest: disparos externos com status de entrega, por conta

Especificação para implementar numa sessão do wacrm. Escrita em 22/10/2026 a partir da especificação de
prospecção do Smart Gest (`D:\repo-local\smartgest\docs\prospeccao-v2.md`, §9.2 e Anexo A). **Nada deste
documento está implementado.** O contrato (§4 e §5) foi escrito para os dois lados; os nomes dos campos
são os mesmos nos dois documentos. Se mudar aqui, mude lá.

## 0. Como usar este documento

Cole no chat do wacrm:

> Leia `CLAUDE.md`, `AGENTS.md`, `WORKLOG.md` e `docs/integracao-smartgest.md`. Implemente a especificação
> inteira, na ordem do §10, e pare no critério de aceite de cada etapa mostrando o resultado. Antes de
> escrever código de Next.js, leia o guia relevante em `node_modules/next/dist/docs/` (o `AGENTS.md`
> avisa que esta versão tem mudanças incompatíveis). Não aplique migration sem me avisar. **O wacrm
> atende várias contas: a integração é por conta, desligada por padrão, e nenhuma outra conta pode ser
> afetada nem ver nada dela. O comportamento dos disparos atuais (`source = 'wacrm'`) não pode mudar.**

## 1. Objetivo

O Smart Gest vai fazer prospecção por WhatsApp **pela Cloud API, usando o número de uma conta do wacrm**.
Ele envia os templates **direto à Meta**. O wacrm continua dono do webhook da Meta e do inbox. Este trabalho
faz duas coisas:

1. **Mostrar no módulo Disparos dessa conta** as mensagens que o Smart Gest enviou, com os mesmos status que
   os disparos próprios já têm: enviado, entregue, lido, respondido e falhou. Sem tela nova de disparo.
2. **Devolver ao Smart Gest**, em tempo quase real, os status e as respostas **só dos destinatários desses
   disparos externos**, para ele parar a cadência, tratar saída ("SAIR") e acionar o disjuntor de qualidade.

### Multi-conta: a regra que organiza o resto

O wacrm roda para o dono do produto **e para outros clientes**, na mesma instância e no mesmo webhook da
Meta. Cada conta (`user_id`) tem o seu número (`whatsapp_config`, uma por conta) e os seus dados, com RLS.
Portanto:

- A integração é **por conta**: cada conta tem a sua chave, os seus segredos e o seu destino de eventos.
  **Nada de variável de ambiente global** para segredo, URL ou "usuário dono".
- A conta de um pedido **nunca vem do corpo**: é derivada da chave que assinou a chamada.
- O recurso fica **desligado para todas as contas** e só liga na conta que o dono habilitar (§7.7).
- Os eventos de uma conta só saem para o destino **dessa** conta, e só os dos destinatários **dessa** conta.

Por que registrar no wacrm em vez de repassar o webhook inteiro: o wacrm recebe todas as mensagens de todos os
números, a maioria de clientes. Repassar o evento bruto levaria dado de cliente para outro sistema.

## 2. O que o wacrm faz hoje (lido em 22/10/2026)

| Peça | Onde | Observação |
|---|---|---|
| Multi-conta | `whatsapp_config` (`001_initial_schema.sql`) | `user_id` único: **um número por conta**, com `phone_number_id`, `waba_id`, `access_token` cifrado. Todas as tabelas têm `user_id` e RLS `auth.uid() = user_id` |
| Webhook da Meta | `src/app/api/whatsapp/webhook/route.ts` | **Um só endpoint** para todas as contas. Acha a conta pelo `metadata.phone_number_id` em `whatsapp_config`; valida `META_APP_SECRET` (`src/lib/whatsapp/webhook-signature.ts`, Web Crypto, roda em Workers) |
| Status de entrega | mesma rota, ~linhas 296–340 | Atualiza `messages.status` por `message_id` e `broadcast_recipients` por `whatsapp_message_id`; **se não achar o destinatário, descarta** ("message wasn't part of a broadcast — fine") |
| Escada de status | `isValidStatusTransition` | Só avança (`pending → sent → delivered → read → replied`); `failed` só a partir de `pending` ou `sent` e é terminal |
| Resposta | `flagBroadcastReplyIfAny(userId, contactId)` | Inbound de um contato com destinatário `sent/delivered/read` vira `replied` (um por vez, o mais recente) |
| Tabelas | `001`, `003`, `005` | `broadcasts` (`user_id` obrigatório, contadores) e `broadcast_recipients` (`contact_id` obrigatório, `whatsapp_message_id` único, `error_message`); gatilho incremental atualiza os contadores |
| Erro do status | mesma rota | O tipo `statuses` **não declara `errors`** e a falha **não grava o motivo** |
| Recurso por conta | `profiles.beta_features text[]` (`011`), `src/hooks/use-auth.tsx` | Padrão já usado para ligar o Flows só na conta do dono |
| Credenciais por conta | `src/lib/whatsapp/encryption.ts` (`encrypt`/`decrypt`, `ENCRYPTION_KEY`), `src/app/api/whatsapp/config/route.ts` | Token do WhatsApp guardado cifrado, por conta |
| Telefone | `src/lib/whatsapp/phone-utils.ts` | `normalizePhone`, `phonesMatch`, `phoneVariants` (com e sem nono dígito) |
| Cron | `src/app/api/automations/cron/route.ts` | `GET` com `x-cron-secret` = `AUTOMATION_CRON_SECRET`; chamado por agendador externo |
| Limite de taxa | `src/lib/rate-limit.ts` | Em memória, por instância; proteção básica |

## 3. Desenho

```
Smart Gest ──(1) envia template──▶ Meta ──▶ destinatário
     │                                 │
     └─(2) POST /envios (assinado com a chave DA CONTA)──▶ wacrm: disparo externo + destinatários ("enviado")
                                       ▲
Meta ──(3) webhook (status / mensagem)─┘  wacrm acha a conta pelo phone_number_id e atualiza o disparo
                                       │
                      (4) só destinatários de disparo externo DESSA conta:
wacrm ──POST evento assinado com o segredo DA CONTA──▶ URL de eventos DA CONTA (fila durável)
```

## 4. Contrato A — Smart Gest registra os envios no wacrm

`POST /api/integracoes/smartgest/envios`

**Autenticação por conta.** Cabeçalhos:

- `x-smartgest-key-id`: identificador público da chave (ex.: `sgk_` + 16 caracteres aleatórios);
- `x-smartgest-timestamp`: segundos;
- `x-smartgest-signature` = `sha256=` + hex de `HMAC-SHA256(segredo_da_conta, timestamp + "." + corpoBruto)`.

O servidor busca a integração por `key_id` (ativa), decifra o segredo dela e confere a assinatura em tempo
constante. **Chave desconhecida, integração desligada, assinatura errada e carimbo com mais de 5 minutos
respondem todos o mesmo `401`, sem detalhe**, para não revelar quais chaves existem. `checkRateLimit` por
`key_id`.

**Corpo** (JSON). **Não há `user_id` no corpo**; a conta é a da chave.

```json
{
  "phone_number_id": "1234567890",
  "campanha": { "id": "uuid-da-campanha-no-smart-gest", "nome": "Prospecção odonto 22/10", "finalizada": false },
  "template": { "nome": "prospeccao_odonto_v1", "idioma": "pt_BR" },
  "envios": [
    {
      "wamid": "wamid.HBgM...",
      "telefone": "5511999999999",
      "nome": "Clínica Sorriso",
      "item_id": "uuid-do-item-no-smart-gest",
      "enviado_em": "2026-10-22T14:03:11-03:00"
    }
  ]
}
```

`phone_number_id` **deve ser o do `whatsapp_config` da conta da chave**; senão `403`. Limites: 1 a **200**
envios por chamada (413 acima disso). Validar o corpo com esquema estrito.

**Comportamento** (tudo com o `user_id` da integração):

1. Achar ou criar o `broadcasts` com `source = 'smartgest'` e `external_id = campanha.id`. Ao criar: `name` =
   `campanha.nome`, `template_name`, `template_language`, `status = 'sending'`. `finalizada = true` muda o
   status para `sent`.
2. Para cada envio, **achar ou criar o contato** da conta pelo telefone normalizado (`normalizePhone` e
   `phoneVariants`). Contato existente **não tem nome nem dados sobrescritos**. Contato novo recebe `name =
   nome` e a etiqueta `prospeccao-smartgest`.
3. Inserir `broadcast_recipients` com `status = 'sent'`, `sent_at = enviado_em`, `whatsapp_message_id = wamid` e
   `external_ref = item_id`. **Idempotente na mesma conta**: `wamid` repetido devolve o registro existente.
   **Se o `wamid` já pertence a outra conta**, responder com `ok: false` e motivo `wamid_em_uso` naquele item,
   **sem devolver nenhum dado** (§8).
4. **Aplicar os status que chegaram antes do registro** (§6, `unmatched_statuses`), **somente os que vieram do
   `phone_number_id` desta conta**, em ordem de carimbo, pela regra de escada.
5. Responder `200`:

```json
{ "ok": true, "broadcast_id": "uuid", "resultados": [ { "wamid": "...", "recipient_id": "uuid", "criado": true } ] }
```

Falha parcial devolve `200` com `"ok": false` no item e o motivo. **Nunca** `5xx` por causa de um envio que já
existe.

**Teste de conexão.** `GET /api/integracoes/smartgest/ping`, assinado como acima (a assinatura cobre
`timestamp + "."`). Devolve `{ "ok": true, "phone_number_id": "…", "numero_exibicao": "…" }` da conta da chave.
É o que o Smart Gest chama ao cadastrar o canal, para provar chave, segredo e número de uma vez.

## 5. Contrato B — wacrm devolve eventos ao Smart Gest

`POST {events_url da integração da conta}` (no Smart Gest: `/api/v1/webhooks/wacrm/<id-do-canal>`).

**Autenticação.** `x-wacrm-timestamp` e `x-wacrm-signature` = `sha256=` + hex de
`HMAC-SHA256(events_secret_da_conta, timestamp + "." + corpoBruto)`. Segredo **diferente** do de entrada.

**Três tipos de evento**, um por chamada (JSON). O corpo traz o `phone_number_id` da conta para o Smart Gest
conferir com o do canal.

```json
{ "tipo": "status", "evento_id": "uuid", "phone_number_id": "1234567890",
  "wamid": "wamid.HBgM...", "item_id": "uuid-do-item",
  "status": "delivered", "timestamp": "2026-10-22T14:03:15-03:00",
  "erro": { "codigo": 131049, "titulo": "…", "detalhes": "…" } }
```

`status` ∈ `sent | delivered | read | failed`. `erro` só em `failed`.

```json
{ "tipo": "resposta", "evento_id": "uuid", "phone_number_id": "1234567890",
  "wamid": "wamid.da-mensagem-recebida", "wamid_origem": "wamid.do-template", "item_id": "uuid-do-item",
  "telefone": "5511999999999", "tipo_mensagem": "text", "texto": "SAIR",
  "botao": { "texto": "Não quero receber", "payload": "optout" }, "timestamp": "2026-10-22T14:20:41-03:00" }
```

`tipo_mensagem` ∈ `text | button | interactive | image | audio | video | document | other`. `wamid_origem` vem de
`context.id` quando o contato responde a um template específico.

```json
{ "tipo": "teste", "evento_id": "uuid", "phone_number_id": "1234567890", "timestamp": "…" }
```

Enviado pelo botão "Testar" da tela de configuração (§7.7).

**Quando emitir** (sempre dentro da **mesma conta**):

- **`status`**: toda vez que o wacrm atualiza um `broadcast_recipients` de disparo `source = 'smartgest'`
  (incluindo `failed`, com o `erro` extraído do evento da Meta).
- **`resposta`**: em **toda** mensagem recebida de um contato que tenha destinatário em disparo
  `source = 'smartgest'` **da mesma conta** com `sent_at` nos **últimos 10 dias**, **mesmo que o destinatário
  já esteja `replied`** (o "SAIR" costuma ser a segunda mensagem). `flagBroadcastReplyIfAny` continua como está.
- **Nunca** para contato que não esteja em disparo externo, e **nunca** para uma conta sem integração ativa.

**Entrega durável.** Cada evento vira uma linha em `smartgest_event_outbox` (com o `integration_id` e o
`user_id`) na mesma operação que atualizou o status, e é entregue em seguida (melhor esforço, timeout de 5 s)
**ao `events_url` daquela integração**. Falha ou resposta diferente de 2xx: nova tentativa pelo cron (§7.4),
com espera de 1, 5, 15 e 60 minutos e depois a cada hora até **24 h**; depois disso a linha vira `abandonado`.
Integração desligada ou removida: as linhas pendentes viram `abandonado` e **nada mais é enviado**. O Smart
Gest trata o `evento_id` como **idempotente**.

**`events_url`** é digitada por cada conta: só `https`, **sem credenciais na URL**, **sem IP literal nem
`localhost`** e sem domínio que resolva para faixa privada (proteção contra SSRF, porque este é um servidor
multi-conta que faz chamadas de saída a pedido do usuário). Validar ao salvar **e** a cada entrega.

**Conciliação, recomendada.** `GET /api/integracoes/smartgest/envios?campanha=<id>&desde=<iso>`, assinado como o
§4 (a assinatura cobre `timestamp + "." + querystring`), devolve o estado atual de cada destinatário **da
conta da chave** (`wamid`, `item_id`, `status`, `delivered_at`, `read_at`, `replied_at`, `erro`).

## 6. Banco (migration nova, idempotente, como as anteriores)

Próximo número livre em `supabase/migrations/` (hoje a última é `012`). Tudo com `IF NOT EXISTS`.

| Mudança | Detalhe |
|---|---|
| `broadcasts.source` | `TEXT NOT NULL DEFAULT 'wacrm' CHECK (source IN ('wacrm','smartgest'))` (todo disparo existente fica `wacrm`) |
| `broadcasts.external_id` | `TEXT`, índice único parcial `(user_id, source, external_id) WHERE external_id IS NOT NULL` (**por conta**) |
| `broadcast_recipients.error_code` | `INTEGER` |
| `broadcast_recipients.external_ref` | `TEXT` (o `item_id` do Smart Gest) |
| `smartgest_integrations` | **Nova**, uma por conta: `id`, `user_id` (único, `REFERENCES auth.users ON DELETE CASCADE`), `key_id` (único), `integration_secret_enc`, `events_url`, `events_secret_enc`, `ativo` (padrão `false`), `ultimo_uso_em`, `ultimo_evento_em`, `ultimo_erro`, `criado_em`, `atualizado_em`. Segredos cifrados com `encrypt` |
| `unmatched_statuses` | **Nova**: `wamid`, `phone_number_id`, `status`, `ocorrido_em`, `erro` (jsonb), `recebido_em`. Índice por `wamid`. **Guarda o `phone_number_id`** para o registro só consumir os da própria conta |
| `smartgest_event_outbox` | **Nova**: `id`, `integration_id`, `user_id`, `evento_id` (único), `payload` (jsonb), `tentativas`, `proxima_tentativa_em`, `entregue_em`, `estado` (`pendente\|entregue\|abandonado`), `ultimo_erro`, `criado_em` |

As tabelas novas são acessadas **só por rotas do servidor**: RLS ligada e **nenhuma política** para `anon` e
`authenticated`, de modo que nem o dono da conta consiga ler os segredos cifrados pelo cliente do Supabase. A
tela (§7.7) conversa com rotas que checam a sessão e nunca devolvem segredo, só metadados. Os `broadcasts` e
destinatários externos pertencem ao `user_id` da integração, então a política existente
(`auth.uid() = user_id`) já os mostra para essa conta e para mais ninguém.

## 7. Mudanças no código

### 7.1 Webhook de status (`webhook/route.ts`)

1. Declarar `errors?: Array<{ code, title, message, error_data?: { details } }>` no tipo de `statuses`.
2. Em `failed`, **gravar `error_code` e `error_message`** (vale também para os disparos próprios, que hoje
   perdem o motivo).
3. Depois de atualizar o destinatário, se o `broadcasts.source = 'smartgest'` **e a conta tem integração
   ativa**, inserir o evento `status` em `smartgest_event_outbox` (com o `integration_id` e o `user_id`).
4. **Quando não houver `messages` nem `broadcast_recipients` que casem** com o `wamid`, gravar em
   `unmatched_statuses` (com o `phone_number_id` do evento) em vez de descartar. Sem isso, o `delivered` e o
   `failed` que chegam em segundos, antes do Smart Gest registrar o envio, se perdem. Limpo pelo cron
   (linhas com mais de 15 min). Gravar **só** quando a conta daquele `phone_number_id` tem integração ativa;
   as demais contas continuam descartando como hoje.

### 7.2 Webhook de mensagem recebida

Depois de resolver a conta (já resolvida hoje pelo `phone_number_id`) e o contato, procurar destinatário em
disparo `source = 'smartgest'` **dessa conta**, com `sent_at` nos últimos 10 dias. Se houver e a integração
estiver ativa, montar e inserir o evento `resposta` (§5). Extrair o texto, o botão de resposta rápida
(`button.payload`/`button.text`) e `context.id`. `flagBroadcastReplyIfAny` fica **como está**. Conta sem
integração: **comportamento idêntico ao de hoje**.

### 7.3 Rotas `envios` e `ping`

Conforme o §4. A autenticação por chave fica **num helper único** (busca por `key_id`, decifra, confere
assinatura e carimbo, devolve a integração) usado por `envios`, `ping` e pela conciliação. Reaproveitar
`normalizePhone`/`phoneVariants`, o cliente administrativo do Supabase e o padrão de erro das rotas existentes.

### 7.4 Rota de cron

`GET /api/integracoes/smartgest/cron`, no padrão de `src/app/api/automations/cron/route.ts` (cabeçalho
`x-cron-secret` contra `AUTOMATION_CRON_SECRET`, 503 se não configurado, 401 se não bate). Faz:
(a) entrega os eventos pendentes cuja `proxima_tentativa_em` venceu, **cada um ao destino da sua integração**,
com a reserva em duas etapas que o cron das automações já usa para não processar a mesma linha duas vezes;
(b) apaga `unmatched_statuses` com mais de 15 minutos; (c) abandona eventos com mais de 24 h ou de integração
desligada. Chamada a cada ~5 minutos pelo mesmo agendador externo que o wacrm já usa.

### 7.5 Entrega inicial do evento

No Cloudflare Workers (OpenNext e Wrangler), uma promessa solta pode ser cancelada quando a resposta à Meta
sai. A primeira tentativa de entrega deve usar **o mesmo mecanismo que o código atual usa para as automações
em segundo plano**, e a implementação precisa **conferir que ele sobrevive nesse ambiente** (`waitUntil` ou
equivalente). Se não sobreviver, a fila + cron do §7.4 cobre, com atraso de até 5 minutos.

### 7.6 Tela Disparos

Ajustes mínimos na lista e na página de detalhe (`src/app/(dashboard)/broadcasts/`), **sem efeito para quem
não usa o recurso**:

- Selo **"Smart Gest"** nos disparos com `source = 'smartgest'` e filtro por origem.
- Esconder editar, reenviar e agendar nesses disparos (o envio é do Smart Gest).
- Na lista de destinatários, mostrar `error_code` e `error_message` dos que falharam (vale para todos).
- Os contadores já vêm do gatilho existente.

### 7.7 Configuração da integração, por conta

- **Liberação por conta.** O recurso só aparece para a conta cujo `profiles.beta_features` contém `'smartgest'`
  (mesmo mecanismo do Flows, `011`). Quem liga é o dono, direto no banco, na conta dele. **Nenhuma outra
  conta vê a tela nem as rotas** (as rotas de gestão respondem 404 para quem não tem o flag).
- **Tela** em Configurações › Integrações › Smart Gest: ligar e desligar; mostrar o `key_id`; botão **Gerar
  chaves** (e **Girar chaves**) que cria o `integration_secret` e o `events_secret` e **mostra os dois uma única
  vez** (depois só os 4 últimos caracteres); campo **URL de eventos** (validação do §5); botão **Testar**
  (envia o evento `tipo: "teste"` e mostra o resultado); estado da última entrega, últimos erros e as últimas 20
  entregas; botão **Revogar** (desativa e abandona a fila).
- **Rotas de gestão** (`/api/integracoes/smartgest/config`, `.../chaves`, `.../testar`) autenticadas pela
  **sessão** (`createClient()` do Supabase, como as demais rotas de configuração) e sempre restritas ao
  `user_id` da sessão. Nunca devolvem segredo, exceto a resposta de criação ou rotação de chaves.
- **Girar** invalida a chave anterior na hora; o Smart Gest precisa receber a nova (§A do documento dele).

## 8. Segurança e privacidade

- **Isolamento entre contas é o requisito principal.** Chave, segredo, URL, disparo, destinatário, fila e
  evento são sempre ligados a um `user_id`, e toda consulta filtra por ele.
- A conta é derivada da **chave assinada**, nunca do corpo. `phone_number_id` do corpo é só conferência.
- **`wamid` de outra conta**: o registro responde `wamid_em_uso`, **sem revelar** se o `wamid` existe, de quem
  é ou o estado dele. `unmatched_statuses` só é consumido pelo `phone_number_id` da própria conta.
- Segredos cifrados com `encrypt`, nunca em log, nunca em resposta (exceto na criação), nunca no repositório.
  Comparação de assinatura em tempo constante. `401` único para tudo que é falha de autenticação.
- **SSRF**: `events_url` validada (§5). Timeout de 5 s e **sem seguir redirecionamento**.
- **O wacrm só envia ao destino de uma conta o que pertence a destinatário de disparo externo dessa conta.** O
  wacrm recebe as mensagens de todos os números, e as de clientes **nunca** saem daqui.
- A URL de callback da Meta e o `META_APP_SECRET` **não mudam**.
- Corpo de erro truncado em 300 caracteres e sem credencial.

## 9. Testes (Vitest, o projeto já tem `vitest.config.ts`)

- **Assinatura e chave**: confere; assinatura errada, chave desconhecida, integração desligada e carimbo velho
  (> 5 min) dão o **mesmo 401**; segredo nunca aparece na resposta nem no log.
- **Isolamento entre contas** (o grupo mais importante), com duas contas A e B e integrações nas duas:
  - chave de A **não** registra nada em B, e `phone_number_id` de B com chave de A → 403;
  - `wamid` já registrado por B, registrado por A → `wamid_em_uso`, sem dado nenhum;
  - status e resposta de destinatário de B **nunca** geram evento para a URL de A, e vice-versa;
  - `unmatched_statuses` de um número de B **não** é aplicado ao registro de A;
  - conta C **sem integração**: webhook com comportamento idêntico ao atual (nenhum evento, nada gravado em
    `unmatched_statuses`);
  - conta sem o flag `smartgest` recebe 404 nas rotas de gestão.
- **Registro**: cria o disparo na primeira chamada e reaproveita nas seguintes; `wamid` repetido na mesma
  conta não duplica; contato existente não é sobrescrito; contato novo recebe a etiqueta; telefone com e sem
  nono dígito casa o mesmo contato; mais de 200 envios → 413; `finalizada` fecha o disparo.
- **Status**: `delivered`, `read` e `failed` atualizam o destinatário e **os contadores do disparo**; `failed`
  grava `error_code` e `error_message`; evento repetido não regride a escada.
- **Chegada antes do registro**: status sem destinatário vai para `unmatched_statuses` e o registro posterior o
  aplica **em ordem**.
- **Resposta**: gera `resposta` com texto, botão e `wamid_origem`; segunda mensagem ("SAIR") de quem já está
  `replied` **também** gera; inbound a 11 dias do envio **não** gera.
- **Entrega**: sucesso marca `entregue`; falha reagenda nos intervalos previstos; 24 h abandona; a reserva em
  duas etapas impede entrega dupla com duas chamadas simultâneas do cron; integração desligada abandona a fila.
- **`events_url`**: rejeita `http`, IP literal, `localhost`, credenciais na URL e domínio que resolve para faixa
  privada; não segue redirecionamento.
- **Regressão**: disparo com `source = 'wacrm'` se comporta **exatamente** como antes.

## 10. Ordem e critérios de aceite

1. **Banco e status completo.** Migration, `errors` do status gravados (§7.1 itens 1 e 2). *Aceite:* um
   disparo próprio que falha agora mostra o código e o motivo; nenhuma outra tela mudou.
2. **Integração por conta e registro.** `smartgest_integrations`, tela de configuração com chaves mostradas
   uma vez e flag por conta (§7.7), helper de autenticação, rotas `envios` e `ping`, `unmatched_statuses`,
   selo e filtro (§7.6). *Aceite:* na conta do dono, ligar o recurso, gerar chaves, `curl` assinado registra 3
   envios e o disparo aparece em Disparos com o selo; repetir a chamada não duplica; um status simulado que
   chega antes do registro é aplicado depois; **numa segunda conta de teste, nada disso existe nem é visível**.
3. **Eventos de volta.** `smartgest_event_outbox`, rota de cron, eventos `status`, `resposta` e `teste`
   (§5, §7.2, §7.4). *Aceite:* contra um servidor de teste que só registra o que recebe, o `delivered` e a
   resposta "SAIR" chegam assinados com o segredo **da conta**; derrubar o servidor de teste e religá-lo entrega
   o pendente; **nenhum** evento de outra conta chega; revogar a integração para tudo.
4. **Conciliação (opcional)**: o `GET` do §5. *Aceite:* devolve o estado de uma campanha de teste, só da conta
   da chave.

## 11. O que **não** fazer

- Não criar variável de ambiente global para segredo, URL de eventos ou "usuário dono" da integração.
- Não aceitar `user_id` ou qualquer identificador de conta vindo do corpo.
- Não mudar a URL de callback da Meta nem o `META_APP_SECRET`.
- Não repassar o evento bruto do webhook, nem para o Smart Gest.
- Não alterar o comportamento dos disparos `source = 'wacrm'` nem de contas sem a integração.
- Não devolver segredo, `wamid` ou estado de outra conta em nenhuma resposta, nem em mensagem de erro.
- Não pôr segredo em log, em resposta (fora da criação) ou em código.
- Não deixar `unmatched_statuses` ou a fila crescerem sem limpeza.
- Não aplicar migration sem avisar.

## 12. Pontos em aberto

1. **Número exclusivo ou compartilhado.** O disparo externo usa o número da conta (um por conta). O risco para
   a qualidade do número que o atendimento usa está em `prospeccao-v2.md` §9.3. Se o dono preferir isolar, a
   prospecção usa **outra conta do wacrm** com outro número, e nada neste documento muda.
2. **Qual conta recebe o flag `smartgest`.** Padrão: só a do dono.
3. **Etiquetas** `prospeccao-smartgest` e `nao-perturbe`: já existem ou precisam ser criadas?
4. **Automação de saída** (sem código): palavra-chave `sair`, `parar`, `pare`, `remover` aplica `nao-perturbe` e
   exclui o contato dos broadcasts da conta. Combinar quem cria.
5. **Cron**: o agendador externo que chama `/api/automations/cron` hoje é o n8n? A nova rota usa o mesmo.
6. **Outros clientes quiserem usar**: o desenho já permite (cada conta liga a sua), desde que o dono libere o
   flag. Fora do escopo agora.
