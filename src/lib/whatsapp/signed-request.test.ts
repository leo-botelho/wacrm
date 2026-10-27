import { describe, expect, it } from 'vitest'
import { parseSignedRequest } from './signed-request'

const SECRET = 'test-meta-app-secret'

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sign(payload: object, secret = SECRET): Promise<string> {
  const encoder = new TextEncoder()
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPayload))
  return `${toBase64Url(new Uint8Array(sig))}.${encodedPayload}`
}

describe('parseSignedRequest', () => {
  it('returns the payload for a valid signature', async () => {
    const req = await sign({ algorithm: 'HMAC-SHA256', user_id: '123' })
    expect(await parseSignedRequest(req, SECRET)).toMatchObject({ user_id: '123' })
  })

  it('rejects a signature made with another secret', async () => {
    const req = await sign({ algorithm: 'HMAC-SHA256', user_id: '123' }, 'other')
    expect(await parseSignedRequest(req, SECRET)).toBeNull()
  })

  it('rejects a tampered payload', async () => {
    const req = await sign({ algorithm: 'HMAC-SHA256', user_id: '123' })
    const [sig] = req.split('.')
    const forged = toBase64Url(
      new TextEncoder().encode(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: '999' })),
    )
    expect(await parseSignedRequest(`${sig}.${forged}`, SECRET)).toBeNull()
  })

  it('rejects malformed input', async () => {
    expect(await parseSignedRequest('not-a-signed-request', SECRET)).toBeNull()
    expect(await parseSignedRequest('a.b.c', SECRET)).toBeNull()
  })
})
