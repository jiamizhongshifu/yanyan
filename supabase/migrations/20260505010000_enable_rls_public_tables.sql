-- Phase 2 安全修复:public schema 全部表启用 RLS,默认 deny all
--
-- 当前架构(Phase 2):
--   - 业务流量 100% 走我们自己的 /api/v1/* 后端,后端用 service_role 连 DB
--   - service_role 自动 bypass RLS,不受影响
--   - 前端只用 Supabase Auth + Storage,不直接 query public 表
--
-- 所以本 migration 只 enable RLS,**不加 anon/authenticated policy**
-- 等于:除 service_role 外完全拒绝(包括所有未授权访问 + 即便有 user JWT 的 authenticated 角色)
--
-- Phase 3 切 Supabase JS client 时(plan v2 已 deferred),再加正式 authenticated policy
-- 让用户限读 / 限写自己的行(`auth.uid() = user_id`)
--
-- food_classifications 和 env_snapshots 是公共数据(无 user_id 列),Phase 3 可加
-- 「authenticated 可 SELECT,无 INSERT/UPDATE/DELETE」类型的 policy 暴露查询;
-- 当前 Phase 2 用户也通过后端读,无需直接访问。

ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptoms               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yan_score_daily        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_consents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.env_snapshots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inapp_reminders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_classifications   ENABLE ROW LEVEL SECURITY;
