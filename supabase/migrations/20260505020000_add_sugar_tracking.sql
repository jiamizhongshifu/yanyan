-- ─────────────────────────────────────────────────────────────────────────
-- 糖分量化追踪 — 添加 added_sugar_g + carbs_g 到食物分类,sugar_grams 到 meals
-- 引入 user_achievements 表,存放糖分等价勋章计数(🍭/🍫/🥤/🧋)
--
-- 设计思路:
--   - 每个食物分类存"典型一份"的添加糖与碳水克数(可空,缺失视为 0)
--   - 每餐 sugar_grams = Σ items.added_sugar_g(缺失计 0)
--   - "减糖勋章"按月聚合:Σ max(0, baseline_daily_sugar - daily_sugar) → 折算成
--     棒棒糖(6g) / 巧克力(12g) / 可乐(35g) / 奶茶(50g) 等价数
--   - baseline:用户头 7 天平均 daily sugar;少于 3 天数据时用默认值 45g(中国成年人均值)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE food_classifications
  ADD COLUMN IF NOT EXISTS added_sugar_g numeric(6,2),
  ADD COLUMN IF NOT EXISTS carbs_g       numeric(6,2);

ALTER TABLE meals
  ADD COLUMN IF NOT EXISTS sugar_grams numeric(7,2);

-- 勋章发放 idempotent 表:同一用户同一天同一类型只发一次(发放数为快照)
CREATE TABLE IF NOT EXISTS user_achievements (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES users(id),
  kind        varchar(32) NOT NULL,
  -- 当 kind='sugar_saved_*' 时,awarded_for_date = 实际节省的"日"
  awarded_for_date date NOT NULL,
  count       integer NOT NULL DEFAULT 1,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_achievements_user_kind_date
  ON user_achievements(user_id, kind, awarded_for_date);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_date
  ON user_achievements(user_id, awarded_for_date DESC);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
-- 无 policy → 默认 deny;service_role 走 BYPASS,前端走 fastify 中转
