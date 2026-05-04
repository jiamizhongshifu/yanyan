-- Yanyan v1 数据库 schema
-- PostgreSQL 14+ (阿里云 RDS 华东 region)
--
-- 设计原则:
--   1. 食物条目双层标签(中医 + 西方营养)— v1 前端只读中医层,后台保留西方层为 Phase 2 算法 / Phase 3 出海预留
--   2. 敏感字段密文存储(envelope encryption,见 src/crypto/envelope.ts)
--   3. RDS TDE 静态加密在 RDS 实例层启用,作为 defense-in-depth
--   4. 所有时间戳用 timestamptz,统一 UTC 存储

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────
-- users:用户主表
--   wx_openid 是微信小程序用户唯一标识;baseline_summary 来自 onboarding 7 维度症状频次
--   dek_ciphertext_b64 是该用户的数据加密密钥(DEK)被 KMS 主密钥保护后的密文
--   consent_version_granted 是用户当前已同意的版本,与 consent_version_required 比对触发拦截
--   deleted_at 软删除时间戳;30 天后由 cron 触发硬删除 + DEK 销毁
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  wx_openid                varchar(64) NOT NULL UNIQUE,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  baseline_summary         jsonb NOT NULL DEFAULT '{}'::jsonb,
  dek_ciphertext_b64       text NOT NULL,
  consent_version_granted  integer NOT NULL DEFAULT 0,
  deleted_at               timestamptz
);
CREATE INDEX IF NOT EXISTS idx_users_wx_openid ON users(wx_openid) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- food_classifications:食物分类种子库
--   双层标签:中医(tcm_label / tcm_property + citation)+ 西方营养(dii_score / ages_score / gi)
--   v1 前端只渲染中医层;Phase 2 算法可同时使用两层
--   typescript 流派支持(plan Phase 3):后续可加 schools jsonb 字段,v1 先单一裁定
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS food_classifications (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  food_canonical_name varchar(128) NOT NULL UNIQUE,
  tcm_label           varchar(8) NOT NULL CHECK (tcm_label IN ('发','温和','平')),
  tcm_property        varchar(8) NOT NULL CHECK (tcm_property IN ('寒','凉','平','温','热')),
  dii_score           numeric(6,3),
  ages_score          numeric(8,2),
  gi                  numeric(5,2),
  citations           jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_versions     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_classifications_name ON food_classifications(food_canonical_name);

-- ─────────────────────────────────────────────────────────────────────────
-- meals:用户餐食记录
--   recognized_items_ciphertext 是用户隐私数据(吃了什么),走 envelope encryption
--   tcm_labels_summary / western_nutrition_summary 是脱敏聚合(无个人识别力),用于 Yan-Score 算法读取
--   photo_oss_key 是 OSS 内部 key(不是完整 URL),按需生成短期签名 URL
--   feedback 包含用户的"误识别"标记,fine-tune 队列消费
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meals (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                     uuid NOT NULL REFERENCES users(id),
  ate_at                      timestamptz NOT NULL,
  photo_oss_key               varchar(256),
  recognized_items_ciphertext text NOT NULL,
  tcm_labels_summary          jsonb NOT NULL DEFAULT '{}'::jsonb,
  western_nutrition_summary   jsonb NOT NULL DEFAULT '{}'::jsonb,
  fire_score                  numeric(5,2),
  feedback                    jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meals_user_ate_at ON meals(user_id, ate_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- symptoms:体感打卡(次晨 + onboarding baseline)
--   blind_input_ciphertext + severity_ciphertext 走 envelope encryption(用户隐私)
--   definition_version:对应 plan Round 2 review 修订 — 滑块档位定义换版后,趋势分析仅在同版本内绘制
--   source 区分次晨打卡 vs onboarding baseline,影响算法读取路径
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS symptoms (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  uuid NOT NULL REFERENCES users(id),
  recorded_for_date        date NOT NULL,
  blind_input_ciphertext   text NOT NULL,
  severity_ciphertext      text NOT NULL,
  definition_version       integer NOT NULL DEFAULT 1,
  source                   varchar(16) NOT NULL CHECK (source IN ('next_morning','onboarding')),
  created_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_symptoms_user_date ON symptoms(user_id, recorded_for_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_symptoms_user_date_source ON symptoms(user_id, recorded_for_date, source);

-- ─────────────────────────────────────────────────────────────────────────
-- yan_score_daily:Yan-Score 历史
--   breakdown 包含 4 个 Part 的归因 + 重分配后的实际权重 + 是否触发 null 降级
--   level: 平 / 微火 / 中火 / 大火(R15 4 档)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS yan_score_daily (
  user_id    uuid NOT NULL REFERENCES users(id),
  date       date NOT NULL,
  food_part  numeric(5,2),
  symptom_part numeric(5,2),
  env_part   numeric(5,2),
  activity_part numeric(5,2),
  total      numeric(5,2),
  level      varchar(8) CHECK (level IN ('平','微火','中火','大火') OR level IS NULL),
  breakdown  jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

-- ─────────────────────────────────────────────────────────────────────────
-- privacy_consents:隐私同意存证
--   scope 覆盖《个保法》第 28 条"敏感个人信息"全部子类:
--     health_data        — 步数/心率/血氧/睡眠等健康生理信息
--     medical_report     — 体检报告 OCR 解析数值
--     photo_ai           — 食物照片送 AI 多模态识别
--     location           — wx.getLocation 行踪轨迹
--     subscribe_push     — wx.requestSubscribeMessage 推送通知
--   一行 = 一次同意事件;最新版本存于 users.consent_version_granted 用于快速比对
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS privacy_consents (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           uuid NOT NULL REFERENCES users(id),
  scope             varchar(32) NOT NULL CHECK (scope IN ('health_data','medical_report','photo_ai','location','subscribe_push')),
  consent_version   integer NOT NULL,
  granted_at        timestamptz NOT NULL DEFAULT now(),
  user_agent        text,
  client_ip_hash    varchar(64)
);
CREATE INDEX IF NOT EXISTS idx_privacy_consents_user ON privacy_consents(user_id, scope, consent_version);

-- ─────────────────────────────────────────────────────────────────────────
-- env_snapshots:环境数据缓存(PM2.5 / 花粉 / 季节)
--   按城市 30 分钟刷新;Yan-Score EnvPart 从这里读
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS env_snapshots (
  city_code   varchar(16) NOT NULL,
  snapshot_at timestamptz NOT NULL,
  pm25        numeric(6,2),
  pollen_level varchar(16),
  season      varchar(8),
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (city_code, snapshot_at)
);
CREATE INDEX IF NOT EXISTS idx_env_snapshots_recent ON env_snapshots(city_code, snapshot_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- push_subscriptions:Web Push 订阅(plan U11 post-pivot)
--   每个浏览器会产生一个 endpoint(FCM / APNS bridge / Mozilla Autopush);同一用户多设备 = 多行
--   uniq endpoint 防重复;Phase 2 服务号备份通道独立另存
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid NOT NULL REFERENCES users(id),
  endpoint      text NOT NULL UNIQUE,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- analytics_events:埋点事件(U12 观测仪表盘消费)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users(id),
  event_name  varchar(64) NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time ON analytics_events(event_name, occurred_at DESC);
