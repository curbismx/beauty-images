import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface ContactFormProps {
  name?: string
  email?: string
  message?: string
}

const ContactFormEmail = ({
  name = '',
  email = '',
  message = '',
}: ContactFormProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New contact form submission from {name || email}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New contact form submission</Heading>
        <Text style={text}>
          Someone has submitted the contact form on BEAUTYIMAGES.
        </Text>

        <Hr style={hr} />

        <Section>
          <Text style={label}>Name</Text>
          <Text style={value}>{name || '—'}</Text>
        </Section>
        <Section>
          <Text style={label}>Email</Text>
          <Text style={value}>{email || '—'}</Text>
        </Section>
        <Section>
          <Text style={label}>Message</Text>
          <Text style={messageStyle}>{message || '—'}</Text>
        </Section>

        <Hr style={hr} />

        <Text style={footer}>
          Reply directly to {email || 'the sender'} to respond.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactFormEmail,
  subject: 'New contact form submission — BEAUTYIMAGES',
  displayName: 'Contact form submission',
  to: 'mail@curbism.com',
  previewData: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    message: 'Hi, I have a question about licensing one of your images.',
  },
} satisfies TemplateEntry

export default ContactFormEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 16px',
  letterSpacing: '0.02em',
}
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 12px' }
const hr = { borderColor: '#eaeaea', margin: '24px 0' }
const label = {
  fontSize: '11px',
  fontWeight: 'bold' as const,
  color: '#999999',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  margin: '0 0 4px',
}
const value = { fontSize: '14px', color: '#000000', margin: '0 0 14px' }
const messageStyle = { fontSize: '14px', color: '#000000', margin: '0 0 14px', whiteSpace: 'pre-wrap' as const, lineHeight: '1.6' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
