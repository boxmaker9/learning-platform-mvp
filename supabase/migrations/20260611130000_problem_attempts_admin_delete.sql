-- 管理者が解答履歴を手動削除できるようにする
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'problem_attempts'
      and policyname = 'admins can delete attempts'
  ) then
    create policy "admins can delete attempts"
    on public.problem_attempts for delete
    using (public.is_org_admin(organization_id));
  end if;
end $$;
