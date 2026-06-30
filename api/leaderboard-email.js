/**
 * api/leaderboard-email.js — Send the weekly leaderboard via the Gmail API (OAuth2)
 *
 * POST { subject, html, week? }   → sends the email, returns { ok, id }
 *
 * Sends FROM your authorized Gmail account (GMAIL_SENDER_EMAIL) using a refresh token.
 * Recipients are fixed server-side (NOT taken from the client). During testing this is
 * just the two addresses below; once approved, replace TEST_RECIPIENTS with the full
 * counsellor list (or load it from a config).
 *
 * Env required (all server-side, no VITE_ prefix):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REFRESH_TOKEN   — must have been granted the https://www.googleapis.com/auth/gmail.send scope
 *   GMAIL_SENDER_EMAIL     — the authorized sending account
 */

const TEST_RECIPIENTS = [
  'pgpaiasmu@gmail.com',
  'siddharth.garg@mastersunion.org',
]

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getAccessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`OAuth token exchange failed: ${data.error || r.status} ${data.error_description || ''}`.trim())
  return data.access_token
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })

  const sender = process.env.GMAIL_SENDER_EMAIL
  const missing = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'GMAIL_SENDER_EMAIL']
    .filter(k => !process.env[k])
  if (missing.length) {
    return res.status(500).json({ error: `Missing Gmail env vars: ${missing.join(', ')}` })
  }

  const { subject, html } = req.body || {}
  if (!subject || !html) return res.status(400).json({ error: 'subject and html are required' })

  try {
    const accessToken = await getAccessToken()

    // RFC 2822 message; subject MIME-encoded for emoji/non-ASCII, body base64.
    const mime = [
      `From: ${sender}`,
      `To: ${TEST_RECIPIENTS.join(', ')}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html, 'utf-8').toString('base64'),
    ].join('\r\n')

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: b64url(mime) }),
    })

    const data = await sendRes.json().catch(() => ({}))
    if (!sendRes.ok) {
      console.error('[api/leaderboard-email] Gmail error', sendRes.status, data)
      return res.status(502).json({ error: data?.error?.message || `Gmail send returned ${sendRes.status}`, detail: data })
    }

    return res.json({ ok: true, id: data.id, recipients: TEST_RECIPIENTS })
  } catch (e) {
    console.error('[api/leaderboard-email]', e.message)
    res.status(500).json({ error: e.message })
  }
}
