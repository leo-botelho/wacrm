# Ajustes nas páginas legais do site (smartskillshub.com.br) para o FlowJob

As páginas atuais (`privacidade.html`, `termos.html`, `exclusao-dados.html`) foram escritas para o **agente de IA** que atende o cliente final. O FlowJob é outra coisa: um **CRM em que empresas conectam o próprio WhatsApp Business**. A Meta avalia se a política cobre o que o app realmente faz, então faltam os blocos abaixo.

Rascunho para revisão jurídica — não substitui advogado. Textos em português, prontos para colar.

## URLs para cadastrar no app da Meta

| Campo | URL |
|---|---|
| Política de privacidade | `https://smartskillshub.com.br/privacidade.html` |
| Termos de serviço | `https://smartskillshub.com.br/termos.html` |
| Exclusão de dados (callback) | `https://crm.smartskillshub.com.br/api/meta/data-deletion` |
| Desautorização (callback) | `https://crm.smartskillshub.com.br/api/meta/deauthorize` |

No app, `/privacidade` e `/termos` agora redirecionam para o site, então há uma única versão de cada texto.

---

## 1. `privacidade.html` — o que acrescentar

**Na seção 1 (Quem somos), acrescentar:**

> A Smart Skills também opera o **FlowJob**, plataforma de atendimento e CRM para WhatsApp em que empresas (nossos "clientes") conectam o próprio número do WhatsApp Business para atender, organizar contatos e automatizar mensagens.

**Nova seção "Dados tratados no FlowJob" (depois da seção 2):**

> **Papéis.** Quanto aos dados dos contatos e das conversas que o cliente atende pelo FlowJob, o **cliente é o controlador** e a Smart Skills atua como **operadora**, tratando os dados apenas para prestar o serviço contratado e conforme as instruções do cliente. Quanto aos dados de cadastro e uso da conta do próprio cliente, a Smart Skills é controladora.
>
> **Dados tratados:** nome, e-mail e credenciais de acesso do usuário do cliente; identificadores da conta do WhatsApp Business e do número conectado; token de acesso fornecido pela Meta; nome, telefone, mensagens, mídias e metadados de entrega dos contatos do cliente; registros técnicos de acesso e de erro.
>
> **Conexão com a Meta.** A conexão do número é feita pelo fluxo oficial de Cadastro Incorporado (Embedded Signup) da Meta. O token de acesso é armazenado **criptografado** e usado exclusivamente para enviar e receber mensagens e gerenciar modelos de mensagem da conta conectada. Não acessamos páginas, anúncios, catálogos ou contas do Instagram do cliente.
>
> **Revogação.** Ao remover o aplicativo nas configurações de integrações de negócios da Meta, o token é apagado e a conexão do WhatsApp é desativada automaticamente. O cliente também pode desconectar o número dentro do FlowJob (Configurações → WhatsApp).

**Na seção 6 (Com quem compartilhamos), conferir se constam:** Meta (WhatsApp Business Platform), Supabase (banco de dados e autenticação), Cloudflare (hospedagem). Se o FlowJob usar outro provedor, incluir.

**Na seção 7 (Por quanto tempo guardamos), acrescentar:**

> No FlowJob, as conversas e os contatos ficam guardados enquanto a conta do cliente estiver ativa. Ao encerrar a conta ou solicitar exclusão, os dados são removidos conforme a página de Exclusão de Dados.

---

## 2. `termos.html` — o que acrescentar

**Na seção 1 (Descrição do serviço), acrescentar:**

> O **FlowJob** é uma plataforma de CRM e atendimento que se integra à API do WhatsApp Business da Meta, permitindo que o cliente envie e receba mensagens, organize contatos e automatize fluxos.

**Nova seção "Uso do FlowJob pelo cliente" (depois da seção 3):**

> O cliente é responsável por:
>
> - cumprir os **Termos do WhatsApp Business** e a **Política de Mensagens do WhatsApp**, incluindo as regras sobre modelos de mensagem e categorias;
> - enviar mensagens **apenas a contatos que consentiram** em recebê-las (opt-in) e respeitar pedidos de descadastro;
> - não usar a plataforma para spam, fraude, conteúdo ilícito, assédio ou qualquer prática vedada pela Meta;
> - manter a confidencialidade das credenciais da conta e responder pelas ações realizadas com elas;
> - ter base legal para tratar os dados dos seus contatos, nos termos da LGPD.
>
> **Dependência da Meta.** O envio e o recebimento de mensagens dependem da plataforma da Meta, que pode alterar regras, limites de envio, preços e aprovar ou recusar modelos de mensagem. A Smart Skills não garante disponibilidade ininterrupta nem se responsabiliza por bloqueios ou restrições aplicados pela Meta ao número ou à conta do cliente.
>
> **Suspensão.** Podemos suspender ou encerrar contas que violem estes termos ou as políticas da Meta. O cliente pode encerrar a conta e revogar o acesso na Meta a qualquer momento.

---

## 3. `exclusao-dados.html` — o que acrescentar

Hoje a página só cobre quem conversou com o agente de IA. Acrescentar um bloco para o FlowJob:

> **Se você usa o FlowJob (cliente):**
>
> - **Remover o aplicativo pela Meta:** em Facebook → Configurações → Integrações de negócios, remova o aplicativo. A conexão do WhatsApp e o token de acesso são apagados automaticamente. Você receberá um código de confirmação, que pode ser consultado em `https://crm.smartskillshub.com.br/exclusao-de-dados?code=SEU_CODIGO`.
> - **Desconectar pelo FlowJob:** em Configurações → WhatsApp, use "Redefinir Configuração".
> - **Excluir a conta, contatos e conversas:** envie o e-mail de "Solicitação de exclusão de dados" a partir do endereço cadastrado. O prazo é o mesmo da página (15 dias úteis).
>
> **Se você é contato de um cliente do FlowJob:** envie "Excluir meus dados" para o número com o qual conversou, ou use o e-mail desta página.

Deixar claro na mesma página que a exclusão de **conversas de contatos** de um cliente pode precisar passar primeiro pelo cliente (controlador).

---

## Antes de submeter à Meta

- Confirme que as três páginas abrem **sem login** e sem redirecionamento quebrado.
- A página de exclusão precisa explicar **como** pedir a exclusão (a atual já faz isso por e-mail e WhatsApp).
- Peça a um advogado para revisar os blocos novos, principalmente papéis controlador/operador e a limitação de responsabilidade.
