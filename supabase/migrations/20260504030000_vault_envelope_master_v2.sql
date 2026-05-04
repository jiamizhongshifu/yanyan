-- Phase 2 U10:Supabase Vault 存放 envelope encryption 主密钥
-- 主密钥 = 32 字节 hex(64 chars),用 pgsodium 自动加密静态存储
-- 服务端通过 RPC get_envelope_master() 读出明文(仅 service-role 可调)

-- pgsodium + supabase_vault 在 hosted Supabase 默认启用
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- 注:Vault 写入主密钥 value 由部署方手动执行(脚本通过 Supabase Studio / API 完成):
--   SELECT vault.create_secret('<64-hex-master-key>', 'yanyan_envelope_master', 'envelope encryption master');
-- 这里只创建 RPC,主密钥本身**不写入 migration**(防泄漏 git)

CREATE OR REPLACE FUNCTION public.get_envelope_master()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
-- 限定 search_path 防函数注入
SET search_path = public, vault
AS $$
DECLARE
  master text;
BEGIN
  SELECT decrypted_secret INTO master
    FROM vault.decrypted_secrets
   WHERE name = 'yanyan_envelope_master'
   LIMIT 1;
  IF master IS NULL THEN
    RAISE EXCEPTION 'envelope master not found in vault';
  END IF;
  RETURN master;
END;
$$;

-- 仅 service_role 可调
REVOKE ALL ON FUNCTION public.get_envelope_master() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_envelope_master() TO service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- set_envelope_master(new_master): service-role 写入 / 更新主密钥
-- 一次性使用 — 应用启动后不应再调
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_envelope_master(new_master text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  existing_id uuid;
  result_id uuid;
BEGIN
  IF new_master IS NULL OR length(new_master) <> 64 THEN
    RAISE EXCEPTION 'master must be 64 hex chars (32 bytes)';
  END IF;
  SELECT id INTO existing_id FROM vault.secrets WHERE name = 'yanyan_envelope_master' LIMIT 1;
  IF existing_id IS NOT NULL THEN
    PERFORM vault.update_secret(existing_id, new_master, 'yanyan_envelope_master', 'envelope encryption master');
    result_id := existing_id;
  ELSE
    SELECT vault.create_secret(new_master, 'yanyan_envelope_master', 'envelope encryption master') INTO result_id;
  END IF;
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_envelope_master(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_envelope_master(text) TO service_role;
