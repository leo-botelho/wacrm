-- ============================================================
-- Embedded Signup (Meta Tech Provider) support.
--
-- whatsapp_config gains:
--   connection_type   how the row was created: 'manual' (token pasted by
--                     the user) or 'embedded_signup' (Meta onboarding flow).
--   meta_user_id      Facebook user id that authorised the app. Meta's
--                     deauthorize / data-deletion callbacks only carry this
--                     id, so it is the key to find the row to remove.
--   registration_pin  AES-GCM encrypted 6-digit PIN used when registering
--                     the number on Cloud API (needed for re-registration).
--
-- meta_data_deletion_requests tracks deletion callbacks so the status URL
-- returned to Meta can show the outcome. Service-role only (RLS on, no
-- policies).
-- ============================================================

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS connection_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (connection_type IN ('manual', 'embedded_signup')),
  ADD COLUMN IF NOT EXISTS meta_user_id TEXT,
  ADD COLUMN IF NOT EXISTS registration_pin TEXT;

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_meta_user_id
  ON whatsapp_config (meta_user_id)
  WHERE meta_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS meta_data_deletion_requests (
  confirmation_code TEXT PRIMARY KEY,
  meta_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed')),
  records_removed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE meta_data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- True when another account already uses this phone_number_id. SECURITY
-- DEFINER so it can see rows hidden from the caller by RLS.
CREATE OR REPLACE FUNCTION whatsapp_phone_in_use(p_phone_number_id TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM whatsapp_config
    WHERE phone_number_id = p_phone_number_id AND user_id <> p_user_id
  );
$fn$;

REVOKE ALL ON FUNCTION whatsapp_phone_in_use(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION whatsapp_phone_in_use(TEXT, UUID) TO authenticated;
