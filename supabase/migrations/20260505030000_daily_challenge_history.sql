-- ─────────────────────────────────────────────────────────────────────────
-- 每日挑战历史 — 让"勋章瓶"能跨日累积
--
-- 一行 = 用户某天的挑战快照(完成数、tier、完成的挑战 keys)。
-- 客户端在挑战值变化时 upsert(idempotent,by user+date 唯一);
-- 洞悉页拉本月所有行 → 聚合 perfect/great/nice 计数 + 月历着色。
--
-- 注意:不是事件流(每变一次插一行)。同一天最多一行,后写覆盖。
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_daily_challenges (
  user_id          uuid NOT NULL REFERENCES users(id),
  date             date NOT NULL,
  tier             varchar(16) NOT NULL CHECK (tier IN ('perfect','great','nice','none')),
  completed_count  integer NOT NULL DEFAULT 0,
  completed_keys   jsonb NOT NULL DEFAULT '[]'::jsonb,
  fire_level       varchar(8),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_udc_user_date ON user_daily_challenges(user_id, date DESC);

ALTER TABLE user_daily_challenges ENABLE ROW LEVEL SECURITY;
-- 无 policy:默认 deny;service_role bypass;前端走 fastify 中转
