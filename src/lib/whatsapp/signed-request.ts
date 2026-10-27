/**
 * Parse and verify the `signed_request` Meta posts to the deauthorize and
 * data-deletion callbacks.
 *
 * Format: `<base64url(signature)>.<base64url(json payload)>`, where the
 * signature is HMAC-SHA256 of the encoded payload keyed with the app secret.
 * Web Crypto only, so it runs on Cloudflare Workers.
 */

function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export interface MetaSignedRequestPayload {
  user_id?: string
  algorithm?: string
  issued_at?: number
  [key: string]: unknown
}

export async function parseSignedRequest(
  signedRequest: string,
  appSecret: string,
): Promise<MetaSignedRequestPayload | null> {
  const parts = signedRequest.split('.')
  if (parts.length !== 2) return null
  const [encodedSig, encodedPayload] = parts

  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(appSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(encodedSig),
      encoder.encode(encodedPayload),
    )
    if (!valid) return null

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(encodedPayload)),
    ) as MetaSignedRequestPayload
    if (payload.algorithm && payload.algorithm.toUpperCase() !== 'HMAC-SHA256') {
      return null
    }
    return payload
  } catch {
    return null
  }
}
