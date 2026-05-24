import * as React from 'react'
import {
  Body,
  Button,
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

interface OrderItem {
  image_number?: number
  title?: string | null
  tier?: string
  price?: number
}

interface OrderConfirmationProps {
  siteName?: string
  downloadUrl?: string
  total?: number
  currency?: string
  items?: OrderItem[]
}

const formatPrice = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(n)
  } catch {
    return `${currency} ${n.toFixed(2)}`
  }
}

const tierLabel = (tier?: string) => {
  switch (tier) {
    case 'small':
      return 'Small (800px)'
    case 'large':
      return 'Large (5400px)'
    default:
      return 'Medium (2000px)'
  }
}

export const OrderConfirmationEmail = ({
  siteName = 'BEAUTYIMAGES',
  downloadUrl = '#',
  total = 0,
  currency = 'GBP',
  items = [],
}: OrderConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} download is ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Thank you for your purchase</Heading>
        <Text style={text}>
          Your order from {siteName} is confirmed. You can download your
          high-resolution images using the button below.
        </Text>
        <Button style={button} href={downloadUrl}>
          Download your images
        </Button>

        <Hr style={hr} />

        <Heading style={h2}>Order summary</Heading>
        {items.map((it, i) => (
          <Section key={i} style={itemRow}>
            <Text style={itemTitle}>
              {it.title || `Image #${it.image_number ?? ''}`}
            </Text>
            <Text style={itemMeta}>
              {tierLabel(it.tier)} — {formatPrice(it.price ?? 0, currency)}
            </Text>
          </Section>
        ))}

        <Hr style={hr} />
        <Text style={totalLine}>
          Total: <strong>{formatPrice(total, currency)}</strong>
        </Text>

        <Text style={footer}>
          The download link stays active so you can return to it any time.
          Each image is licensed under our standard terms — see our licence
          page for details.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderConfirmationEmail,
  subject: 'Your BEAUTYIMAGES download is ready',
  displayName: 'Order confirmation',
  previewData: {
    siteName: 'BEAUTYIMAGES',
    downloadUrl: 'https://beautyimages.com/checkout/return?session_id=cs_test_example',
    total: 425,
    currency: 'GBP',
    items: [
      { image_number: 12, title: 'Morning Light', tier: 'medium', price: 275 },
      { image_number: 47, title: 'Coastal Bloom', tier: 'small', price: 150 },
    ],
  },
} satisfies TemplateEntry

export default OrderConfirmationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 16px',
  letterSpacing: '0.02em',
}
const h2 = {
  fontSize: '14px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const button = {
  backgroundColor: '#000000',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '4px',
  padding: '12px 22px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#eaeaea', margin: '28px 0' }
const itemRow = { margin: '0 0 14px' }
const itemTitle = { fontSize: '14px', color: '#000000', margin: '0 0 2px', fontWeight: 'bold' as const }
const itemMeta = { fontSize: '13px', color: '#55575d', margin: '0' }
const totalLine = { fontSize: '15px', color: '#000000', margin: '0 0 24px' }
const footer = { fontSize: '12px', color: '#999999', margin: '20px 0 0', lineHeight: '1.5' }
