/**
 * Static API key used by external integrations (n8n etc.) in place of a
 * session. `FLOWJOB_API_KEY` is the current name; `WACRM_API_KEY` (the
 * pre-rebrand name) is still honoured so existing deployments and
 * integrations keep working until the env var is renamed.
 */
export function getExpectedApiKey(): string | undefined {
  return process.env.FLOWJOB_API_KEY || process.env.WACRM_API_KEY || undefined
}

export function isValidApiKey(key: string | null | undefined): boolean {
  const expected = getExpectedApiKey()
  if (!expected || !key) return false
  return key.trim() === expected.trim()
}
