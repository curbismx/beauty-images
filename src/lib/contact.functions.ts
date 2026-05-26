import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { sendTransactionalEmail } from '@/lib/email/send-transactional.server'

const ContactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Invalid email').max(255),
  message: z.string().trim().min(1, 'Message is required').max(2000),
})

export const submitContactForm = createServerFn({ method: 'POST' })
  .inputValidator((input) => ContactSchema.parse(input))
  .handler(async ({ data }) => {
    const idempotencyKey = `contact-${Date.now()}-${crypto.randomUUID()}`

    const result = await sendTransactionalEmail({
      supabase: supabaseAdmin,
      templateName: 'contact-form',
      recipientEmail: 'mail@curbism.com',
      idempotencyKey,
      templateData: {
        name: data.name,
        email: data.email,
        message: data.message,
      },
    })

    if (!result.success && result.reason !== 'already_queued') {
      console.error('Contact form email failed', result)
      throw new Error('Failed to send message. Please try again or email mail@curbism.com directly.')
    }

    return { success: true }
  })
