# Roadmap

Atualizado em 2026-10-27. Itens em ordem de prioridade; marque `[x]` ao concluir e registre no `WORKLOG.md`.

## 1. Rebrand para FlowJob (prioridade alta — antes de submeter o app à Meta)

O nome do produto passa a ser **FlowJob**. Isso vem antes do App Review da Meta porque o nome do app, o logo, as páginas legais e a tela de consentimento do Embedded Signup precisam já refletir a marca final.

### 1.1 Identidade visual
- [x] Conceito do logo definido: monograma F em traço contínuo com nó, quadrado roxo `#7c3aed` (opção A). Falta variação clara/escura e lockup com nome, se necessário.
- [x] Arquivos exportados em `public/brand/`: SVG e PNG 1024×1024 transparente (ícone do app Meta); favicon em `src/app/icon.svg`.
- [ ] Definir paleta e confirmar se o roxo atual (`themes.ts`) continua.

### 1.2 Textos visíveis no sistema (hoje dizem "MetaZap CRM")
- [x] `src/app/layout.tsx` — `title.default` e `title.template`
- [x] `src/components/layout/sidebar.tsx` — nome ao lado do logo
- [x] `src/components/icons/logo.tsx` — componentes `Logo` e `LogoMark` + comentário
- [x] `src/app/icon.svg` — favicon
- [x] Telas de login, cadastro e recuperação de senha (usam `LogoMark`, já com o novo glifo; sem texto com o nome antigo)
- [ ] E-mails transacionais do Supabase Auth (Supabase → Authentication → Email Templates) e nome do remetente
- [x] Páginas legais: nome FlowJob aplicado em `/privacidade` e `/termos` (restam razão social, CNPJ, e-mail, foro)

### 1.3 Nomes técnicos (hoje `wacrm`) — mudar com cuidado
| Onde | Hoje | Observação |
|---|---|---|
| `package.json` `name` | `wacrm` | seguro renomear |
| `wrangler.jsonc` `name` e `service` | `wacrm` | **renomear troca o Worker publicado**; combinar com domínio/rotas e atualizar o deploy |
| Variável `WACRM_API_KEY` | usada em `middleware.ts`, `send`, `media` | **quebra integrações (n8n etc.)**; aceitar as duas (`FLOWJOB_API_KEY` e a antiga) durante a transição |
| `localStorage` `wacrm.theme` (`themes.ts`) | `wacrm.theme` | renomear faz o usuário perder o tema salvo uma vez; migrar lendo a chave antiga |
| `.env.local.example` | menciona `wacrm.tech` | atualizar para o domínio novo |
| `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `.github/*` | `wacrm` / `ArnasDon/wacrm` | os links apontam para o repositório de origem (fork); trocar para o repositório próprio |
| Repositório GitHub | `leo-botelho/wacrm` | renomear o repo e atualizar o `git remote` |
| Projeto Supabase | `MetaZap` | só rótulo no painel; opcional |

### 1.4 Fora do código (Meta e infraestrutura)
- [ ] Nome de exibição do app Meta (App Settings → Basic) e ícone 1024×1024
- [ ] Nome do negócio no Meta Business Portfolio e perfil do WhatsApp Business
- [ ] Domínio novo (se houver) e atualizar `NEXT_PUBLIC_SITE_URL`, URLs de webhook, deauthorize e data deletion no painel da Meta
- [ ] Pasta do projeto `D:\repo-local\wacrm` e a linha correspondente no `CLAUDE.md` raiz do workspace

### 1.5 Pronto quando
- Nenhum texto visível ao usuário diz "MetaZap" ou "wacrm" (`grep -ri "metazap\|wacrm"` só retorna o que for intencional, como a chave antiga em modo de compatibilidade).
- Integrações existentes continuam funcionando com a chave antiga.

## 2. Meta Tech Provider (em andamento)

Código pronto (Embedded Signup, callbacks, páginas legais). Falta o lado Meta e o texto jurídico.

- [x] Embedded Signup, callbacks de deauthorize e exclusão de dados, token de verificação do app
- [x] Migration `013_embedded_signup.sql` aplicada
- [ ] Rebrand FlowJob concluído (item 1: faltam nomes técnicos e itens fora do código)
- [ ] Revisão jurídica e preenchimento das páginas `/privacidade`, `/termos`, `/exclusao-de-dados`
- [ ] Business Verification no Meta Business Portfolio
- [ ] App em modo Live, `config_id` do Embedded Signup, env vars de produção
- [ ] App Review: Advanced Access em `whatsapp_business_management` e `whatsapp_business_messaging`, com screencast
- [ ] Registro como Tech Provider e aceite dos termos de parceiro
- [ ] Teste ponta a ponta com uma conta real em modo desenvolvimento

## 3. Smart Gest — disparos externos com status de entrega

Especificação em [integracao-smartgest.md](./integracao-smartgest.md). Nada implementado.
