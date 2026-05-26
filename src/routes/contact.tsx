import { createFileRoute, Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { submitContactForm } from '@/lib/contact.functions'

export const Route = createFileRoute('/contact')({
  head: () => ({
    meta: [
      { title: 'Contact — BEAUTYIMAGES' },
      { name: 'description', content: 'Contact BEAUTYIMAGES for queries, licensing and support.' },
      { property: 'og:title', content: 'Contact — BEAUTYIMAGES' },
      { property: 'og:description', content: 'Contact BEAUTYIMAGES for queries, licensing and support.' },
    ],
  }),
  component: ContactPage,
})

const css = `
.bi-contact { min-height: 100vh; background: #fff; color: #111; font-family: 'Inter', system-ui, -apple-system, sans-serif; position: relative; padding: 140px 24px 80px; }
.bi-contact-logo { position: absolute; top: 40px; left: 0; height: 40px; }
.bi-contact-logo img { height: 100%; width: auto; display: block; }
.bi-contact-inner { max-width: 560px; margin: 0 auto; }
.bi-contact h1 { font-size: 22px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; margin: 0 0 18px; }
.bi-contact p.intro { font-size: 14px; line-height: 1.7; color: #444; margin: 0 0 32px; }
.bi-contact p.intro a { color: #D75F68; text-decoration: none; font-weight: 700; }
.bi-contact p.intro a:hover { text-decoration: underline; }
.bi-contact form { display: flex; flex-direction: column; gap: 14px; }
.bi-contact label { font-size: 10px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #111; }
.bi-contact input, .bi-contact textarea { width: 100%; background: #fff; color: #111; border: 1px solid #111; padding: 12px 14px; font-size: 14px; border-radius: 0; outline: none; font-family: inherit; }
.bi-contact input:focus, .bi-contact textarea:focus { border-color: #D75F68; }
.bi-contact textarea { min-height: 160px; resize: vertical; }
.bi-contact button { background: #111; color: #fff; border: 1px solid #111; padding: 14px; font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer; font-family: inherit; margin-top: 8px; transition: background 0.15s ease, color 0.15s ease; }
.bi-contact button:hover:not(:disabled) { background: #D75F68; border-color: #D75F68; }
.bi-contact button:disabled { opacity: 0.5; cursor: not-allowed; }
.bi-contact .msg-ok { color: #2a7a3a; font-size: 13px; font-weight: 700; }
.bi-contact .msg-err { color: #D75F68; font-size: 13px; font-weight: 700; }
.bi-contact .back { display: inline-block; margin-top: 40px; font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #111; text-decoration: none; }
.bi-contact .back:hover { color: #D75F68; }
@media (max-width: 768px) { .bi-contact { padding: 110px 22px 60px; } .bi-contact-logo { top: 40px; height: 36px; } }
`

function ContactPage() {
  const send = useServerFn(submitContactForm)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setOk(false)
    try {
      await send({ data: { name, email, message } })
      setOk(true)
      setName('')
      setEmail('')
      setMessage('')
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="bi-contact">
        <Link to="/" className="bi-contact-logo" aria-label="Beauty Images — home">
          <img src="/beauty-logo.png" alt="Beauty Images" />
        </Link>
        <div className="bi-contact-inner">
          <h1>Contact</h1>
          <p className="intro">
            Any queries or support issues please contact us direct through the management company{' '}
            <a href="mailto:mail@curbism.com">mail@curbism.com</a> or fill in the form below.
          </p>
          <form onSubmit={onSubmit}>
            <div>
              <label htmlFor="c-name">Name</label>
              <input id="c-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
            </div>
            <div>
              <label htmlFor="c-email">Email</label>
              <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
            </div>
            <div>
              <label htmlFor="c-message">Message</label>
              <textarea id="c-message" value={message} onChange={(e) => setMessage(e.target.value)} required maxLength={2000} />
            </div>
            {error && <div className="msg-err">{error}</div>}
            {ok && <div className="msg-ok">Thanks — your message has been sent. We'll get back to you shortly.</div>}
            <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button>
          </form>
          <Link to="/" className="back">← Back to home</Link>
        </div>
      </div>
    </>
  )
}
