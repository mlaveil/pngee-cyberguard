BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret_enc text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enrolled_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_recovery_hashes jsonb NOT NULL DEFAULT '[]';

COMMIT;
