import * as React from 'react'
import { render } from '@react-email/components'
import type { SupabaseClient } from '@supabase/supabase-js'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'beautyimages'
const SENDER_DOMAIN = 'notify.beautyimages.com'
const FROM_DOMAIN = 'beautyimages.com'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

interface SendOpts {
  supabase: SupabaseClient
  templateName: string
  recipientEmail: string
  idempotencyKey: string
  templateData?: Record<string, any>
}

/**
 * Server-side helper to render + enqueue a transactional email without
 * requiring a user JWT. Intended for server-to-server triggers like
 * Stripe webhooks. Mirrors the logic in /lovable/email/transactional/send.
 */
export async function sendTransactionalEmail({
  supabase,
  templateName,
  recipientEmail,
  idempotencyKey,
  templateData = {},
}: SendOpts): Promise<{ success: boolean; reason?: string }> {
  const template = TEMPLATES[templateName]
  if (!template) {
    console.error('Unknown template', { templateName })
    return { success: false, reason: 'unknown_template' }
  }

  const effectiveRecipient = template.to || recipientEmail
  const normalizedEmail = effectiveRecipient.toLowerCase()

  // Suppression check
  const { data: suppressed } = await supabase
    .from('suppressed_emails')
    .select('email')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (suppressed) {
    return { success: false, reason: 'suppressed' }
  }

  const messageId = idempotencyKey

  // Skip if already sent (idempotency)
  const { data: alreadySent } = await supabase
    .from('email_send_log')
    .select('id')
    .eq('message_id', messageId)
    .in('status', ['sent', 'pending'])
    .maybeSingle()

  if (alreadySent) {
    return { success: true, reason: 'already_queued' }
  }

  // Get or create unsubscribe token
  let unsubscribeToken: string
  const { data: existing } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existing && !existing.used_at) {
    unsubscribeToken = existing.token
  } else if (!existing) {
    unsubscribeToken = generateToken()
    await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true },
      )
    const { data: stored } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()
    unsubscribeToken = stored?.token ?? unsubscribeToken
  } else {
    return { success: false, reason: 'unsubscribed' }
  }

  // Render
  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  // Log pending
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: 'pending',
  })

  const { error } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (error) {
    console.error('Failed to enqueue transactional email', { error, templateName })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return { success: false, reason: 'enqueue_failed' }
  }

  return { success: true }
}
