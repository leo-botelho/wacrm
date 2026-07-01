import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { runAutomationById } from '@/lib/automations/engine'

/**
 * Fires one specific automation on demand — the "macro" button in the
 * conversation view. Unlike /api/automations/engine (which runs every
 * automation matching a trigger_type), this runs exactly the automation
 * the agent picked, e.g. "Ativar Agente" after taking over a conversation.
 * CRM-session auth only; this is a UI action, not an external integration.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const automationId = body?.automation_id
  const conversationId = body?.conversation_id
  if (!automationId || !conversationId) {
    return NextResponse.json(
      { error: 'automation_id and conversation_id are required' },
      { status: 400 }
    )
  }

  const { data: conversation, error: convError } = await supabaseAdmin()
    .from('conversations')
    .select('*, contact:contacts(*)')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const contact = conversation.contact

  const result = await runAutomationById(automationId, user.id, contact?.id ?? null, {
    conversation_id: conversationId,
    contact_name: contact?.name,
    contact_phone: contact?.phone,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
