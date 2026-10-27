import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseSignedRequest } from '@/lib/whatsapp/signed-request'

/**
 * POST /api/meta/data-deletion
 *
 * Meta "Data Deletion Request URL". Removes the WhatsApp configuration
 * (including the encrypted token) tied to the Facebook user and returns
 * the `{ url, confirmation_code }` shape Meta expects. Conversations and
 * contacts belong to the CRM account and are removed by deleting the
 * account itself — see /exclusao-de-dados.
 */
export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const form = await request.formData().catch(() => null)
  const signedRequest = form?.get('signed_request')
  if (typeof signedRequest !== 'string') {
    return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 })
  }

  const payload = await parseSignedRequest(signedRequest, appSecret)
  if (!payload?.user_id) {
    return NextResponse.json({ error: 'Invalid signed_request' }, { status: 403 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: removed, error: deleteError } = await admin
    .from('whatsapp_config')
    .delete()
    .eq('meta_user_id', payload.user_id)
    .select('id')

  if (deleteError) {
    console.error('[meta/data-deletion] delete failed:', deleteError.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const confirmationCode = crypto.randomUUID()
  const { error: insertError } = await admin
    .from('meta_data_deletion_requests')
    .insert({
      confirmation_code: confirmationCode,
      meta_user_id: payload.user_id,
      status: 'completed',
      records_removed: removed?.length ?? 0,
    })
  if (insertError) {
    console.error('[meta/data-deletion] log failed:', insertError.message)
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    new URL(request.url).origin
  return NextResponse.json({
    url: `${origin}/exclusao-de-dados?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  })
}
