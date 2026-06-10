/**
 * Verify the HMAC-SHA256 signature Meta attaches to webhook POSTs.
 *
 * Uses the Web Crypto API so this module runs on Cloudflare Workers
 * Edge Runtime without needing the Node.js crypto built-in.
 *
 * crypto.subtle.verify() is timing-safe by spec — no need for a
 * manual timingSafeEqual workaround.
 */

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export async function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const secret = process.env.META_APP_SECRET
  if (!secret) {
    console.error(
      '[webhook] META_APP_SECRET is not set — rejecting request. ' +
        'Configure the env var (Meta → App Settings → Basic → App Secret) ' +
        'to enable signature verification.',
    )
    return false
  }

  if (!signatureHeader) return false
  if (!signatureHeader.startsWith('sha256=')) return false

  const sigHex = signatureHeader.slice('sha256='.length)
  if (sigHex.length % 2 !== 0) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  return crypto.subtle.verify(
    'HMAC',
    key,
    hexToBytes(sigHex),
    encoder.encode(rawBody),
  )
}
