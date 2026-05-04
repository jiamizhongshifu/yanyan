-- Phase 2 U9:in-app 通知兜底队列
CREATE TABLE IF NOT EXISTS inapp_reminders (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid NOT NULL REFERENCES users(id),
  kind          varchar(32) NOT NULL CHECK (kind IN ('morning_checkin','pdf_ready','weekly_digest')),
  title         varchar(128) NOT NULL,
  body          varchar(512) NOT NULL,
  url           text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  dismissed_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_inapp_reminders_user_pending
  ON inapp_reminders(user_id, created_at DESC)
  WHERE dismissed_at IS NULL;
