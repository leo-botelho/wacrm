import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Termos de Uso' }

// RASCUNHO: revisar com assessoria jurídica e preencher os campos
// [ENTRE COLCHETES] antes de submeter o app à revisão da Meta.
export default function TermsPage() {
  return (
    <>
      <h1>Termos de Uso</h1>
      <p>Última atualização: [DATA]</p>
      <p>
        Estes termos regulam o uso do FlowJob, operado por [RAZÃO SOCIAL],
        CNPJ [CNPJ]. Ao criar uma conta ou conectar um número de WhatsApp, você concorda
        com eles.
      </p>

      <h2>1. O serviço</h2>
      <p>
        Plataforma de atendimento e CRM que se integra à API do WhatsApp Business da
        Meta, permitindo enviar e receber mensagens, organizar contatos e automatizar
        fluxos.
      </p>

      <h2>2. Responsabilidades do cliente</h2>
      <ul>
        <li>
          Cumprir os{' '}
          <a href="https://www.whatsapp.com/legal/business-terms" target="_blank" rel="noopener noreferrer">
            Termos do WhatsApp Business
          </a>{' '}
          e a Política de Comércio e de Mensagens do WhatsApp.
        </li>
        <li>Enviar mensagens apenas a contatos que consentiram em recebê-las (opt-in).</li>
        <li>Não usar o serviço para spam, fraude ou conteúdo ilícito.</li>
        <li>Manter a confidencialidade das credenciais da conta.</li>
      </ul>

      <h2>3. Disponibilidade</h2>
      <p>
        O envio e recebimento de mensagens depende da plataforma da Meta, que pode
        alterar regras, limites e preços. Não garantimos disponibilidade ininterrupta.
      </p>

      <h2>4. Suspensão e encerramento</h2>
      <p>
        Podemos suspender contas que violem estes termos ou as políticas da Meta. Você
        pode encerrar sua conta e revogar o acesso à Meta a qualquer momento.
      </p>

      <h2>5. Dados pessoais</h2>
      <p>
        O tratamento de dados segue a <a href="/privacidade">Política de Privacidade</a>.
      </p>

      <h2>6. Contato e foro</h2>
      <p>[E-MAIL DE CONTATO]. Foro: [CIDADE/UF].</p>
    </>
  )
}
