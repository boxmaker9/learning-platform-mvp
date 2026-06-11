-- 管理者が作成時の初期パスワードを参照できるようにする（MVP）
alter table public.user_profiles
  add column if not exists initial_password text;
