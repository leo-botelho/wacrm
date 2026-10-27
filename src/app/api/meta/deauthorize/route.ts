import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseSignedRequest } from '@/lib/whatsapp/signed-request'

/**
 * POST /api/meta/deauthorize
 *
 * Meta "Deauthorize Callback URL": called when a user removes the app from
 * their Facebook/Business settings. We disconnect and wipe the stored
 * access token for every WhatsApp config tied to that Facebook user.
 * Public route (no session) — authenticity comes from the signed_request.
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
  // access_token is NOT NULL, so overwrite with an empty string: the token
  // is gone and status flips to disconnected until the user reconnects.
  const { error } = await admin
    .from('whatsapp_config')
    .update({
      status: 'disconnected',
      access_token: '',
      registration_pin: null,
    })
    .eq('meta_user_id', payload.user_id)

  if (error) {
    console.error('[meta/deauthorize] update failed:', error.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
