import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  exchangeCodeForToken,
  getTokenUserId,
  registerPhoneNumber,
  subscribeAppToWaba,
  verifyPhoneNumber,
} from '@/lib/whatsapp/meta-api'
import { encrypt } from '@/lib/whatsapp/encryption'

/**
 * POST /api/whatsapp/embedded-signup
 *
 * Finishes the Meta Embedded Signup flow started in the browser.
 * Body: { code, waba_id, phone_number_id }
 *   - code: short-lived code from FB.login (response_type=code)
 *   - waba_id / phone_number_id: from the WA_EMBEDDED_SIGNUP FINISH event
 *
 * Steps: exchange code → verify number → subscribe app to the WABA →
 * register number on Cloud API (best effort) → store encrypted config.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appId = process.env.NEXT_PUBLIC_META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: 'Embedded Signup não configurado (NEXT_PUBLIC_META_APP_ID / META_APP_SECRET).' },
      { status: 500 },
    )
  }

  const body = (await request.json().catch(() => null)) as {
    code?: unknown
    waba_id?: unknown
    phone_number_id?: unknown
  } | null
  const code = typeof body?.code === 'string' ? body.code : ''
  const wabaId = typeof body?.waba_id === 'string' ? body.waba_id : ''
  const phoneNumberId =
    typeof body?.phone_number_id === 'string' ? body.phone_number_id : ''
  if (!code || !wabaId || !phoneNumberId) {
    return NextResponse.json(
      { error: 'code, waba_id e phone_number_id são obrigatórios' },
      { status: 400 },
    )
  }

  // A number can only feed one CRM account — the webhook routes by it.
  const { data: taken } = await supabase.rpc('whatsapp_phone_in_use', {
    p_phone_number_id: phoneNumberId,
    p_user_id: user.id,
  })
  if (taken === true) {
    return NextResponse.json(
      { error: 'Este número já está conectado a outra conta.' },
      { status: 409 },
    )
  }

  let accessToken: string
  let phoneInfo
  try {
    accessToken = await exchangeCodeForToken({ code, appId, appSecret })
    phoneInfo = await verifyPhoneNumber({ phoneNumberId, accessToken })
    await subscribeAppToWaba({ wabaId, accessToken })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[embedded-signup] Meta step failed:', message)
    return NextResponse.json({ error: `Meta API: ${message}` }, { status: 400 })
  }

  const metaUserId = await getTokenUserId({
    inputToken: accessToken,
    appId,
    appSecret,
  })

  // Register on Cloud API. May fail if the number is already registered —
  // not fatal, the number can still send/receive in that case.
  const pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
  let pinToStore: string | null = null
  try {
    await registerPhoneNumber({ phoneNumberId, accessToken, pin })
    pinToStore = await encrypt(pin)
  } catch (err) {
    console.warn(
      '[embedded-signup] register skipped:',
      err instanceof Error ? err.message : err,
    )
  }

  let encryptedToken: string
  try {
    encryptedToken = await encrypt(accessToken)
  } catch (err) {
    console.error('[embedded-signup] encryption failed:', err)
    return NextResponse.json(
      { error: 'Falha ao criptografar o token. Verifique ENCRYPTION_KEY.' },
      { status: 500 },
    )
  }

  const { error: saveError } = await supabase.from('whatsapp_config').upsert(
    {
      user_id: user.id,
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      access_token: encryptedToken,
      verify_token: null,
      status: 'connected',
      connected_at: new Date().toISOString(),
      connection_type: 'embedded_signup',
      meta_user_id: metaUserId,
      registration_pin: pinToStore,
    },
    { onConflict: 'user_id' },
  )
  if (saveError) {
    console.error('[embedded-signup] save failed:', saveError.message)
    return NextResponse.json({ error: 'Falha ao salvar a configuração' }, { status: 500 })
  }

  return NextResponse.json({ success: true, phone_info: phoneInfo })
}
