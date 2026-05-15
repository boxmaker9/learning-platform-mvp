-- 解答履歴: 6ヶ月超を削除する関数と一覧用インデックス
-- 自動削除の例（Supabase で pg_cron を有効化したうえで SQL エディタで1回実行）:
--   select cron.schedule(
--     'purge-problem-attempts',
--     '0 4 * * *',
--     'select public.delete_problem_attempts_older_than_six_months()'
--   );

-- 解答履歴の一覧パフォーマンス用
create index if not exists problem_attempts_org_created_at_idx
  on public.problem_attempts (organization_id, created_at desc);

-- 6ヶ月より古い problem_attempts を削除（SECURITY DEFINER で RLS を回避）
create or replace function public.delete_problem_attempts_older_than_six_months()
returns bigint
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.problem_attempts
    where created_at < (now() at time zone 'utc') - interval '6 months'
    returning id
  )
  select count(*)::bigint from deleted;
$$;

comment on function public.delete_problem_attempts_older_than_six_months() is
  'Deletes problem_attempts older than 6 months. Schedule daily with pg_cron: select public.delete_problem_attempts_older_than_six_months();';

revoke all on function public.delete_problem_attempts_older_than_six_months() from public;
grant execute on function public.delete_problem_attempts_older_than_six_months() to postgres;
grant execute on function public.delete_problem_attempts_older_than_six_months() to service_role;
