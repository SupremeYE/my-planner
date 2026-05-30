-- public.users_view 제거
--
-- 문제: 이 뷰는 auth.users 의 id·email·created_at 을 SELECT 하며 anon 역할에
--       SELECT 권한이 부여돼 있어, 공개 anon 키로 조회 시 로그인 계정 이메일이 노출됨
--       (SECURITY DEFINER + auth.users 노출 — Supabase advisor ERROR 2건).
-- 확인: 앱 코드(src/, api/) 어디에서도 사용하지 않음.
-- 조치: 뷰 삭제.

DROP VIEW IF EXISTS public.users_view;
