import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Política de Privacidade' }

// RASCUNHO: revisar com assessoria jurídica e preencher os campos
// [ENTRE COLCHETES] antes de submeter o app à revisão da Meta.
export default function PrivacyPage() {
  return (
    <>
      <h1>Política de Privacidade</h1>
      <p>Última atualização: [DATA]</p>
      <p>
        Esta política descreve como o [NOME DO PRODUTO] (&quot;nós&quot;), operado por
        [RAZÃO SOCIAL], CNPJ [CNPJ], trata dados pessoais, em conformidade com a Lei
        Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).
      </p>

      <h2>1. Papéis</h2>
      <p>
        Em relação aos dados dos seus contatos e conversas, o cliente que usa a plataforma
        é o <strong>controlador</strong> e nós atuamos como <strong>operador</strong>. Em
        relação aos dados de cadastro e uso da conta, nós somos o controlador.
      </p>

      <h2>2. Dados que tratamos</h2>
      <ul>
        <li>Dados de cadastro: nome, e-mail e credenciais de acesso.</li>
        <li>
          Dados da integração com o WhatsApp Business: identificadores da conta e do
          número, e token de acesso fornecido pela Meta (armazenado criptografado).
        </li>
        <li>
          Dados de conversas: nome, telefone, mensagens, mídias e metadados de entrega
          dos contatos que falam com o cliente pelo WhatsApp.
        </li>
        <li>Dados técnicos: registros de acesso e de erro para segurança e diagnóstico.</li>
      </ul>

      <h2>3. Finalidades</h2>
      <p>
        Prestar o serviço de atendimento e CRM, enviar e receber mensagens pela API do
        WhatsApp Business, garantir a segurança da plataforma e cumprir obrigações legais.
      </p>

      <h2>4. Compartilhamento</h2>
      <p>
        Os dados são processados pela Meta Platforms (WhatsApp Business Platform) para
        entregar mensagens, e por provedores de infraestrutura que hospedam a plataforma
        ([PROVEDORES: ex. Supabase, Cloudflare]). Não vendemos dados pessoais.
      </p>

      <h2>5. Retenção e exclusão</h2>
      <p>
        Mantemos os dados enquanto a conta estiver ativa. Ao revogar o acesso na Meta, o
        token é apagado e a conexão é desativada. Para excluir seus dados, veja{' '}
        <a href="/exclusao-de-dados">Exclusão de dados</a>.
      </p>

      <h2>6. Seus direitos</h2>
      <p>
        Você pode solicitar confirmação de tratamento, acesso, correção, anonimização,
        portabilidade e exclusão dos seus dados, nos termos do art. 18 da LGPD, pelo
        e-mail [E-MAIL DO ENCARREGADO].
      </p>

      <h2>7. Segurança</h2>
      <p>
        Tokens de acesso são criptografados em repouso, o acesso aos dados é isolado por
        conta e o tráfego usa HTTPS.
      </p>

      <h2>8. Contato</h2>
      <p>Encarregado de dados: [NOME] — [E-MAIL DO ENCARREGADO].</p>
    </>
  )
}
