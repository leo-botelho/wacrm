import { NextResponse } from 'next/server'

// Temporary diagnostic endpoint — remove after debugging WACRM_API_KEY issue
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const keyFromQuery = searchParams.get('api_key')
  const keyFromHeader =
    request.headers.get('X-Api-Key') ?? request.headers.get('x-api-key')
  const provided = keyFromQuery ?? keyFromHeader ?? null

  const expected = process.env.WACRM_API_KEY ?? null

  return NextResponse.json({
    env_set: !!expected,
    env_length: expected?.length ?? 0,
    provided_length: provided?.length ?? 0,
    match: !!expected && !!provided && provided.trim() === expected.trim(),
  })
}
