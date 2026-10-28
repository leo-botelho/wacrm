import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { getMediaUrl, downloadMedia } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'

function isValidApiKey(key: string | null): boolean {
  const expected = process.env.WACRM_API_KEY
  if (!expected || !key) return false
  return key.trim() === expected.trim()
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { mediaId } = await params

    if (!mediaId) {
      return NextResponse.json({ error: 'Media ID is required' }, { status: 400 })
    }

    // Accept api_key as query param OR X-Api-Key header (easier to configure in n8n)
    const { searchParams } = new URL(request.url)
    const keyFromQuery = searchParams.get('api_key')
    const keyFromHeader = request.headers.get('X-Api-Key') ?? request.headers.get('x-api-key')
    const isApiKey = isValidApiKey(keyFromQuery) || isValidApiKey(keyFromHeader)

    if (!isApiKey) {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { data: config, error: configError } = await supabaseAdmin()
      .from('whatsapp_config')
      .select('*')
      .limit(1)
      .single()

    if (configError || !config) {
      return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 400 })
    }

    const accessToken = await decrypt(config.access_token)

    const mediaInfo = await getMediaUrl({ mediaId, accessToken })

    const { buffer, contentType } = await downloadMedia({
      downloadUrl: mediaInfo.url,
      accessToken,
    })

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType || mediaInfo.mimeType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    console.error('Error in WhatsApp media GET:', error)
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 })
  }
}
