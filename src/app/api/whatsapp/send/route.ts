import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTextMessage, sendTemplateMessage } from '@/lib/whatsapp/meta-api'
import { decrypt, encrypt, isLegacyFormat } from '@/lib/whatsapp/encryption'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'

function isValidApiKey(key: string | null): boolean {
  const expected = process.env.WACRM_API_KEY
  if (!expected || !key) return false
  return key.trim() === expected.trim()
}

export async function POST(request: Request) {
  try {
    // Auth: Supabase session (browser) OR api key via X-Api-Key header /
    // ?api_key= query param (n8n / external). Track which path was used —
    // automations downstream need to tell "a human replied from the CRM"
    // apart from "the n8n integration replied".
    let userId: string
    let sentByCrm: boolean
    const { searchParams } = new URL(request.url)
    const apiKey =
      request.headers.get('X-Api-Key') ??
      request.headers.get('x-api-key') ??
      searchParams.get('api_key')
    if (isValidApiKey(apiKey)) {
      const { data: cfg, error: cfgError } = await supabaseAdmin()
        .from('whatsapp_config')
        .select('user_id')
        .limit(1)
        .single()
      if (cfgError || !cfg) {
        console.error('[whatsapp/send] api-key auth ok but whatsapp_config lookup failed:', cfgError?.message)
        return NextResponse.json(
          { error: `WhatsApp not configured: ${cfgError?.message ?? 'no rows'}` },
          { status: 500 }
        )
      }
      userId = cfg.user_id
      sentByCrm = false
    } else {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
      sentByCrm = true
    }

    // All DB operations use admin client with explicit user_id filters
    const db = supabaseAdmin()

    // Per-user rate limit. Bucket key is scoped to this route so
    // `/broadcast` has an independent budget.
    const limit = checkRateLimit(`send:${userId}`, RATE_LIMITS.send)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    const body = await request.json()
    const {
      conversation_id,
      message_type,
      content_text,
      media_url,
      template_name,
      template_language,
      template_params,
      reply_to_message_id,
    } = body

    if (!conversation_id || !message_type) {
      return NextResponse.json(
        { error: 'conversation_id and message_type are required' },
        { status: 400 }
      )
    }

    if (message_type === 'text' && !content_text) {
      return NextResponse.json(
        { error: 'content_text is required for text messages' },
        { status: 400 }
      )
    }

    if (message_type === 'template' && !template_name) {
      return NextResponse.json(
        { error: 'template_name is required for template messages' },
        { status: 400 }
      )
    }

    // Fetch conversation and contact
    const { data: conversation, error: convError } = await db
      .from('conversations')
      .select('*, contact:contacts(*)')
      .eq('id', conversation_id)
      .eq('user_id', userId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    const contact = conversation.contact
    if (!contact?.phone) {
      return NextResponse.json(
        { error: 'Contact phone number not found' },
        { status: 400 }
      )
    }

    // Sanitize and validate phone
    const sanitizedPhone = sanitizePhoneForMeta(contact.phone)
    if (!isValidE164(sanitizedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    // Fetch and decrypt WhatsApp config
    const { data: config, error: configError } = await db
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp not configured. Please set up your WhatsApp integration first.' },
        { status: 400 }
      )
    }

    const accessToken = await decrypt(config.access_token)

    // Self-heal legacy CBC-encrypted tokens. Fire-and-forget: we
    // return from the send without waiting, so a failed upgrade just
    // means the next send tries again. The upgrade is idempotent —
    // concurrent sends both produce valid GCM ciphertexts of the same
    // plaintext, last write wins.
    if (isLegacyFormat(config.access_token)) {
      void (async () => {
        const upgradedToken = await encrypt(accessToken)
        const { error } = await db
          .from('whatsapp_config')
          .update({ access_token: upgradedToken })
          .eq('id', config.id)
        if (error) {
          console.warn('[whatsapp/send] access_token GCM upgrade failed:', error.message)
        }
      })()
    }

    // Resolve the reply target (if any) to its Meta message_id, which is
    // what `context.message_id` on the outgoing Meta payload needs. The
    // parent must belong to this same conversation — otherwise a caller
    // could quote messages they can't see by guessing UUIDs.
    let contextMessageId: string | undefined
    if (reply_to_message_id) {
      const { data: parent, error: parentError } = await db
        .from('messages')
        .select('message_id, conversation_id')
        .eq('id', reply_to_message_id)
        .eq('conversation_id', conversation_id)
        .maybeSingle()

      if (parentError || !parent) {
        return NextResponse.json(
          { error: 'reply_to_message_id not found in this conversation' },
          { status: 400 }
        )
      }
      if (!parent.message_id) {
        // Parent never reached Meta (still in 'sending' or 'failed') — we
        // can't quote it on WhatsApp. Send without context rather than
        // dropping the message entirely.
        console.warn(
          '[whatsapp/send] reply target has no Meta message_id; sending without context'
        )
      } else {
        contextMessageId = parent.message_id
      }
    }

    // Send via Meta API — retry with phone-number variants if Meta rejects
    // with "recipient not in allowed list" (common in sandbox / when a
    // number was registered with/without a trunk 0). If an alternate
    // format succeeds, we persist it back to the contact row so the
    // next send goes through on the first attempt.
    let waMessageId = ''
    let workingPhone = sanitizedPhone

    const attempt = async (phone: string): Promise<string> => {
      if (message_type === 'template') {
        const result = await sendTemplateMessage({
          phoneNumberId: config.phone_number_id,
          accessToken,
          to: phone,
          templateName: template_name,
          language: template_language,
          params: template_params || [],
          contextMessageId,
        })
        return result.messageId
      }
      const result = await sendTextMessage({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: phone,
        text: content_text,
        contextMessageId,
      })
      return result.messageId
    }

    try {
      const variants = phoneVariants(sanitizedPhone)
      let lastError: unknown = null

      for (const variant of variants) {
        try {
          waMessageId = await attempt(variant)
          workingPhone = variant
          lastError = null
          break
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          // Only retry when the failure is specifically that the
          // recipient isn't in Meta's allowed list. Any other error
          // (bad token, invalid template, etc.) bubbles up immediately.
          if (!isRecipientNotAllowedError(message)) {
            throw err
          }
          lastError = err
          console.warn(`[whatsapp/send] variant "${variant}" rejected by Meta, trying next…`)
        }
      }

      if (lastError) throw lastError
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      console.error('Meta API send failed for all variants:', message)
      return NextResponse.json(
        { error: `Meta API error: ${message}` },
        { status: 502 }
      )
    }

    // If a non-original variant succeeded, update the contact so future
    // sends go straight through. sanitizePhoneForMeta on workingPhone
    // will yield workingPhone itself, so re-storing preserves it.
    if (workingPhone !== sanitizedPhone) {
      console.log(
        `[whatsapp/send] Auto-corrected contact phone: ${sanitizedPhone} → ${workingPhone}`
      )
      await db
        .from('contacts')
        .update({ phone: workingPhone })
        .eq('id', contact.id)
    }

    // Insert message into DB — field names MUST match the messages schema
    // (see supabase/migrations/001_initial_schema.sql):
    //   conversation_id, sender_type, content_type, content_text,
    //   media_url, template_name, message_id, status, created_at
    const { data: messageRecord, error: msgError } = await db
      .from('messages')
      .insert({
        conversation_id,
        sender_type: 'agent',
        content_type: message_type,
        content_text: content_text || null,
        media_url: media_url || null,
        template_name: template_name || null,
        message_id: waMessageId,
        status: 'sent',
        reply_to_message_id: reply_to_message_id || null,
      })
      .select()
      .single()

    if (msgError) {
      console.error('Error inserting sent message:', msgError)
      return NextResponse.json(
        { error: `Message sent to Meta but failed to save to DB: ${msgError.message}` },
        { status: 500 }
      )
    }

    // Update conversation
    await db
      .from('conversations')
      .update({
        last_message_text: content_text || `[${message_type}]`,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation_id)

    // Notify automations that a message was sent — lets an n8n integration
    // tell "a human replied from the CRM" (sent_by_crm=true) apart from its
    // own replies (sent_by_crm=false) and react (e.g. pause its AI agent).
    // Awaited: Cloudflare Workers kills background promises once the
    // response is sent, and runAutomationsForTrigger never throws.
    await runAutomationsForTrigger({
      userId,
      triggerType: 'message_sent',
      contactId: contact.id,
      context: {
        message_text: content_text || null,
        conversation_id,
        contact_name: contact.name,
        contact_phone: contact.phone,
        message_type,
        media_url: media_url || null,
        sent_by_crm: sentByCrm,
        from_me: true,
      },
    })

    // Pause any active Flow run for this contact — the agent stepping
    // in is the strongest "yield, human is here" signal. See PR #2
    // plan for why we pause (not end): preserves diagnostic state +
    // lets the agent or the 24h timeout sweep cleanly resolve the
    // run later. For accounts with no active runs the UPDATE matches
    // zero rows — cheap and harmless.
    try {
      const { error: pauseErr } = await supabaseAdmin()
        .from('flow_runs')
        .update({
          status: 'paused_by_agent',
          ended_at: new Date().toISOString(),
          end_reason: 'agent_replied',
        })
        .eq('user_id', userId)
        .eq('contact_id', contact.id)
        .eq('status', 'active')
      if (pauseErr) {
        // Best-effort — log + continue. The agent's message already
        // landed at Meta; don't fail the response over a bookkeeping
        // miss. Worst case: a stale active run gets caught by the
        // stale-run cron sweep within 24h.
        console.error('[flows] pause-on-agent-send failed:', pauseErr.message)
      }
    } catch (err) {
      console.error(
        '[flows] pause-on-agent-send threw:',
        err instanceof Error ? err.message : err,
      )
    }

    return NextResponse.json({
      success: true,
      message_id: messageRecord.id,
      whatsapp_message_id: waMessageId,
    })
  } catch (error) {
    console.error('Error in WhatsApp send POST:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
