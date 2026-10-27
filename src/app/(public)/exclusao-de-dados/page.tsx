import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

export const metadata: Metadata = { title: 'Exclusão de dados' }
export const dynamic = 'force-dynamic'

// RASCUNHO: preencher [E-MAIL] antes de submeter o app à revisão da Meta.
export default async function DataDeletionPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams

  let request: { status: string; records_removed: number; created_at: string } | null = null
  if (code) {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data } = await admin
      .from('meta_data_deletion_requests')
      .select('status, records_removed, created_at')
      .eq('confirmation_code', code)
      .maybeSingle()
    request = data
  }

  return (
    <>
      <h1>Exclusão de dados</h1>

      {code && (
        <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="font-medium text-white">Código de confirmação: {code}</p>
          {request ? (
            <p>
              Status: <strong>{request.status === 'completed' ? 'concluída' : 'em andamento'}</strong>
              {' · '}solicitada em {new Date(request.created_at).toLocaleDateString('pt-BR')}
              {' · '}
              {request.records_removed} conexão(ões) do WhatsApp removida(s).
            </p>
          ) : (
            <p>Não encontramos uma solicitação com este código.</p>
          )}
        </section>
      )}

      <h2>Como excluir seus dados</h2>
      <ul>
        <li>
          <strong>Pela Meta:</strong> em Facebook → Configurações → Integrações de
          negócios, remova o aplicativo. A conexão do WhatsApp e o token de acesso são
          apagados automaticamente.
        </li>
        <li>
          <strong>Pela plataforma:</strong> em Configurações → WhatsApp, use
          &quot;Redefinir Configuração&quot;.
        </li>
        <li>
          <strong>Conta, contatos e conversas:</strong> envie um e-mail para [E-MAIL] a
          partir do endereço cadastrado. Atendemos em até 15 dias.
        </li>
      </ul>
      <p>
        Veja também a <a href="/privacidade">Política de Privacidade</a>.
      </p>
    </>
  )
}
