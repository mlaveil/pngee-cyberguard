BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_pending_secret_enc text;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS family_id text;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS replaced_by text;
CREATE INDEX IF NOT EXISTS refresh_tokens_family_idx ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_token_hash_idx ON refresh_tokens(token_hash);

CREATE TABLE IF NOT EXISTS mfa_challenges (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mfa_challenges_user_idx ON mfa_challenges(user_id, expires_at);
CREATE INDEX IF NOT EXISTS mfa_challenges_expiry_idx ON mfa_challenges(expires_at);

COMMIT;
