-- ─────────────────────────────────────────────────────────────────────────
-- 健康数据每日记录(步数 / 心率等),Apple Health 通过 iOS 快捷指令 POST,
-- 也支持手动录入。一行 = 一用户一天,后写覆盖。
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_health_daily (
  user_id     uuid NOT NULL REFERENCES users(id),
  date        date NOT NULL,
  steps       integer,
  resting_hr  integer,
  source      varchar(32) NOT NULL DEFAULT 'manual',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_uhd_user_date ON user_health_daily(user_id, date DESC);

ALTER TABLE user_health_daily ENABLE ROW LEVEL SECURITY;
-- service_role bypass;前端走 fastify 中转
