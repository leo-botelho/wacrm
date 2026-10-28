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

### 1.3 Nomes técnicos (antes `wacrm`)
| Onde | Estado |
|---|---|
| `package.json` / `package-lock.json` `name` | [x] `flowjob` |
| Variável de API | [x] `FLOWJOB_API_KEY`; `WACRM_API_KEY` continua aceita como fallback (`src/lib/api-key.ts`). **Ação sua:** criar `FLOWJOB_API_KEY` no Worker e, quando as integrações (n8n) usarem a nova, apagar a antiga e remover o fallback |
| `localStorage` do tema | [x] `flowjob.theme`, lendo `wacrm.theme` como fallback (o tema salvo não se perde) |
| `README.md` título, `WORKLOG.md` título | [x] |
| `.env.local.example` | [x] `FLOWJOB_API_KEY` documentada e domínio de produção |
| `wrangler.jsonc` `name` e `service` (`wacrm`) | [ ] **mantido de propósito.** Renomear cria outro Worker: os secrets (`ENCRYPTION_KEY`, `META_APP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`…) e o domínio `crm.smartskillshub.com.br` ficam no Worker antigo e teriam de ser recriados/movidos. Fazer só com janela de manutenção |
| Repositório GitHub (`leo-botelho/wacrm`) e links `ArnasDon/wacrm` em `README`, `CONTRIBUTING`, `.github/` | [ ] renomear o repositório pelo GitHub (Settings → Rename) e depois trocar os links |
| Projeto Supabase (`MetaZap`) | [ ] opcional, só rótulo no painel |

### 1.4 Fora do código (Meta e infraestrutura)
- [ ] Nome de exibição do app Meta (App Settings → Basic) e ícone 1024×1024
- [ ] Nome do negócio no Meta Business Portfolio e perfil do WhatsApp Business
- [ ] Domínio novo (se houver) e atualizar `NEXT_PUBLIC_SITE_URL`, URLs de webhook, deauthorize e data deletion no painel da Meta
- [ ] Pasta do projeto `D:\repo-local\wacrm` e a linha correspondente no `CLAUDE.md` raiz do workspace

### 1.5 Pronto quando
- Nenhum texto visível ao usuário diz "MetaZap" ou "wacrm" (`grep -ri "metazap\|wacrm"` só retorna o que for intencional, como a chave antiga em modo de compatibilidade).
- Integrações existentes continuam funcionando com a chave antiga (fallback ativo).

## 2. Meta Tech Provider (em andamento)

Código pronto (Embedded Signup, callbacks, páginas legais). Falta o lado Meta e o texto jurídico.

- [x] Embedded Signup, callbacks de deauthorize e exclusão de dados, token de verificação do app
- [x] Migration `013_embedded_signup.sql` aplicada
- [ ] Rebrand FlowJob concluído (item 1: faltam nomes técnicos e itens fora do código)
- [ ] Páginas legais: usar as do site (`smartskillshub.com.br/privacidade.html`, `termos.html`, `exclusao-dados.html`) e acrescentar os blocos do FlowJob de `docs/ajustes-paginas-legais.md`; revisão jurídica. No app, `/privacidade` e `/termos` redirecionam para o site e `/exclusao-de-dados` só mostra o status do callback
- [ ] Business Verification no Meta Business Portfolio
- [ ] App em modo Live, `config_id` do Embedded Signup, env vars de produção
- [ ] App Review: Advanced Access em `whatsapp_business_management` e `whatsapp_business_messaging`, com screencast
- [ ] Registro como Tech Provider e aceite dos termos de parceiro
- [ ] Teste ponta a ponta com uma conta real em modo desenvolvimento

## 3. Smart Gest — disparos externos com status de entrega

Especificação em [integracao-smartgest.md](./integracao-smartgest.md). Nada implementado.
