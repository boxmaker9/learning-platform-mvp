-- Multi-tenant schema for Supabase (single DB, RLS enforced)

create type public.organization_role as enum ('admin', 'student');
create type public.problem_type as enum ('single_choice', 'multiple_choice', 'text');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'student',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.organization_role not null default 'student',
  token uuid not null default gen_random_uuid(),
  status public.invitation_status not null default 'pending',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  prompt text,
  type public.problem_type not null,
  answer_text text,
  explanation text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.problem_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  label text not null,
  position integer not null default 0,
  is_correct boolean not null default false
);

create table public.problem_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  selected_option_ids uuid[],
  answer_text text,
  is_correct boolean,
  created_at timestamptz not null default now()
);

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.courses enable row level security;
alter table public.problems enable row level security;
alter table public.problem_options enable row level security;
alter table public.problem_attempts enable row level security;

create policy "org members can read orgs"
on public.organizations for select
using (public.is_org_member(id));

create policy "authenticated can create orgs"
on public.organizations for insert
with check (auth.uid() is not null);

create policy "admins can update orgs"
on public.organizations for update
using (public.is_org_admin(id));

create policy "admins can delete orgs"
on public.organizations for delete
using (public.is_org_admin(id));

create policy "members can read memberships"
on public.organization_members for select
using (public.is_org_member(organization_id) or user_id = auth.uid());

create policy "admins manage memberships"
on public.organization_members for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "invitees can join"
on public.organization_members for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.organization_invitations i
    where i.organization_id = organization_id
      and lower(i.email) = lower(auth.jwt() ->> 'email')
      and i.status = 'pending'
  )
);

create policy "admins manage invitations"
on public.organization_invitations for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "invitees can read"
on public.organization_invitations for select
using (lower(email) = lower(auth.jwt() ->> 'email'));

create policy "invitees can accept"
on public.organization_invitations for update
using (
  status = 'pending'
  and lower(email) = lower(auth.jwt() ->> 'email')
)
with check (
  status in ('pending', 'accepted')
  and lower(email) = lower(auth.jwt() ->> 'email')
);

create policy "members can read courses"
on public.courses for select
using (public.is_org_member(organization_id));

create policy "admins manage courses"
on public.courses for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "members can read problems"
on public.problems for select
using (public.is_org_member(organization_id));

create policy "admins manage problems"
on public.problems for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "members can read options"
on public.problem_options for select
using (public.is_org_member(organization_id));

create policy "admins manage options"
on public.problem_options for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "members can read attempts"
on public.problem_attempts for select
using (public.is_org_admin(organization_id) or user_id = auth.uid());

create policy "students can create attempts"
on public.problem_attempts for insert
with check (
  public.is_org_member(organization_id)
  and user_id = auth.uid()
);

