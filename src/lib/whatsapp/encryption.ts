/**
 * WhatsApp token encryption — Web Crypto API version.
 *
 * Format — GCM (current):
 *   `<iv-hex>:<ciphertext-hex>:<authTag-hex>`      (three colons)
 *
 * Format — CBC (legacy, decrypt-only):
 *   `<iv-hex>:<ciphertext-hex>`                    (one colon)
 *
 * All functions are async because the Web Crypto API is async-only.
 * This lets the module run on Cloudflare Workers Edge Runtime without
 * needing the Node.js crypto built-in.
 */

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!
const GCM_IV_LENGTH = 12
const CBC_IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function importKey(usage: 'encrypt' | 'decrypt', algorithm: 'AES-GCM' | 'AES-CBC'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    hexToBytes(ENCRYPTION_KEY),
    { name: algorithm },
    false,
    [usage],
  )
}

export async function encrypt(text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_LENGTH))
  const key = await importKey('encrypt', 'AES-GCM')
  const encoded = new TextEncoder().encode(text)
  const result = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, encoded)
  // Web Crypto AES-GCM appends the auth tag to the end of the ciphertext.
  const resultBytes = new Uint8Array(result)
  const ciphertext = resultBytes.slice(0, -AUTH_TAG_LENGTH)
  const authTag = resultBytes.slice(-AUTH_TAG_LENGTH)
  return `${bytesToHex(iv)}:${bytesToHex(ciphertext)}:${bytesToHex(authTag)}`
}

export async function decrypt(encryptedText: string): Promise<string> {
  const parts = encryptedText.split(':')

  if (parts.length === 3) {
    const [ivHex, ctHex, tagHex] = parts
    const iv = hexToBytes(ivHex)
    if (iv.length !== GCM_IV_LENGTH) {
      throw new Error(`Encrypted token has unexpected GCM IV length ${iv.length}`)
    }
    const authTag = hexToBytes(tagHex)
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Encrypted token has unexpected GCM auth-tag length ${authTag.length}`)
    }
    const ct = hexToBytes(ctHex)
    // Web Crypto expects ciphertext + auth tag concatenated.
    const ctWithTag = new Uint8Array(ct.length + authTag.length)
    ctWithTag.set(ct)
    ctWithTag.set(authTag, ct.length)
    const key = await importKey('decrypt', 'AES-GCM')
    const result = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, ctWithTag)
    return new TextDecoder().decode(result)
  }

  if (parts.length === 2) {
    const [ivHex, ctHex] = parts
    const iv = hexToBytes(ivHex)
    if (iv.length !== CBC_IV_LENGTH) {
      throw new Error(`Encrypted token has unexpected CBC IV length ${iv.length}`)
    }
    const key = await importKey('decrypt', 'AES-CBC')
    const result = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, hexToBytes(ctHex))
    return new TextDecoder().decode(result)
  }

  throw new Error(
    `Encrypted token has unrecognised format (expected 1 or 2 colons, got ${parts.length - 1})`,
  )
}

export function isLegacyFormat(encryptedText: string): boolean {
  return encryptedText.split(':').length === 2
}
