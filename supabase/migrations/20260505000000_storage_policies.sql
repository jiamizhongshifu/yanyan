-- Phase 2:Storage RLS 策略 — 用户只能读/写自己 path 下的对象
-- Path 约定:users/<auth_uid>/<meal_id 或 sub>/...

-- ─────────────────────────────────────────────────────────────────────────
-- food-photos:用户上传食物照片;服务端用 service-role 读取做识别
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_insert_own_food_photo" ON storage.objects;
CREATE POLICY "users_insert_own_food_photo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'food-photos'
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "users_select_own_food_photo" ON storage.objects;
CREATE POLICY "users_select_own_food_photo"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'food-photos'
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "users_delete_own_food_photo" ON storage.objects;
CREATE POLICY "users_delete_own_food_photo"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'food-photos'
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- profile-pdf:Day 30 体质档案;只读;服务端写(service-role 自动 bypass)
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_own_pdf" ON storage.objects;
CREATE POLICY "users_select_own_pdf"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'profile-pdf'
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
