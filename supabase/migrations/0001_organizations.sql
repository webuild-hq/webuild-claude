-- ============================================================
-- 0001 : agences, membres, invitations, préférences, connexions MCP
-- ============================================================
-- Tout appartient à une organisation (l'agence). Les lectures passent par RLS,
-- les écritures sensibles par des fonctions (RPC) qui vérifient les droits.

-- ------------------------------------------------------------
-- Types
-- ------------------------------------------------------------
create type public.org_role as enum ('owner', 'admin', 'member');

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(email) and email like '%@%'),
  role public.org_role not null default 'member' check (role <> 'owner'),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
-- Une seule invitation en attente par email et par agence.
create unique index invitations_pending_unique
  on public.invitations (organization_id, email) where accepted_at is null;

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_organization_id uuid references public.organizations (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Agence par défaut choisie sur l'écran de consentement, par client OAuth (Claude).
create table public.mcp_connections (
  user_id uuid not null references auth.users (id) on delete cascade,
  oauth_client_id text not null,
  default_organization_id uuid references public.organizations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, oauth_client_id)
);

-- ------------------------------------------------------------
-- Fonctions d'aide pour RLS (security definer : évite la récursion des policies)
-- ------------------------------------------------------------
create function public.is_org_member(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = (select auth.uid())
  );
$$;

create function public.has_org_role(org uuid, roles public.org_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = (select auth.uid()) and m.role = any (roles)
  );
$$;

create function public.shares_org_with(other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  );
$$;

-- ------------------------------------------------------------
-- Slug unique à partir d'un nom ("Agence Dupont" -> "agence-dupont", puis "-2", ...)
-- ------------------------------------------------------------
create function public.unique_org_slug(source text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  base := lower(source);
  base := translate(base, 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa');
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from base);
  base := left(base, 50);
  base := trim(both '-' from base);
  if base = '' then
    base := 'agence';
  end if;
  candidate := base;
  -- "new" est réservé : /dashboard/new est la page de création d'agence.
  while candidate = 'new' or exists (select 1 from public.organizations o where o.slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end;
$$;

-- ------------------------------------------------------------
-- RPC : créer une agence (le créateur devient propriétaire)
-- ------------------------------------------------------------
create function public.create_organization(org_name text)
returns public.organizations
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  org public.organizations;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (trim(org_name), public.unique_org_slug(org_name), uid)
  returning * into org;

  insert into public.memberships (organization_id, user_id, role) values (org.id, uid, 'owner');

  insert into public.user_preferences (user_id, last_organization_id) values (uid, org.id)
  on conflict (user_id) do update set last_organization_id = excluded.last_organization_id, updated_at = now();

  return org;
end;
$$;

-- ------------------------------------------------------------
-- RPC : inviter un membre (propriétaire ou admin)
-- ------------------------------------------------------------
create function public.create_invitation(org uuid, invite_email text, invite_role public.org_role default 'member')
returns public.invitations
language plpgsql volatile security definer set search_path = ''
as $$
declare
  inv public.invitations;
  normalized text := lower(trim(invite_email));
begin
  if not public.has_org_role(org, array['owner', 'admin']::public.org_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if invite_role = 'owner' then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id
    where m.organization_id = org and lower(u.email) = normalized
  ) then
    raise exception 'already_member' using errcode = '23505';
  end if;

  -- Remplace une éventuelle invitation en attente pour le même email.
  delete from public.invitations i
  where i.organization_id = org and i.email = normalized and i.accepted_at is null;

  insert into public.invitations (organization_id, email, role, invited_by)
  values (org, normalized, invite_role, (select auth.uid()))
  returning * into inv;

  return inv;
end;
$$;

-- ------------------------------------------------------------
-- RPC : lire une invitation par son lien (avant de l'accepter)
-- ------------------------------------------------------------
create function public.get_invitation(invite_token uuid)
returns table (organization_name text, email text, role public.org_role, status text)
language sql stable security definer set search_path = ''
as $$
  select o.name, i.email, i.role,
    case
      when i.accepted_at is not null then 'accepted'
      when i.expires_at < now() then 'expired'
      else 'pending'
    end
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token = invite_token;
$$;

-- ------------------------------------------------------------
-- RPC : accepter une invitation (l'email du compte doit correspondre)
-- ------------------------------------------------------------
create function public.accept_invitation(invite_token uuid)
returns public.organizations
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  inv public.invitations;
  user_email text;
  org public.organizations;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into inv from public.invitations i where i.token = invite_token for update;
  if inv.id is null or inv.accepted_at is not null or inv.expires_at < now() then
    raise exception 'invitation_invalid' using errcode = '22023';
  end if;

  select lower(u.email) into user_email from auth.users u where u.id = uid;
  if user_email is distinct from inv.email then
    raise exception 'email_mismatch' using errcode = '42501';
  end if;

  insert into public.memberships (organization_id, user_id, role)
  values (inv.organization_id, uid, inv.role)
  on conflict (organization_id, user_id) do nothing;

  update public.invitations set accepted_at = now() where id = inv.id;

  insert into public.user_preferences (user_id, last_organization_id) values (uid, inv.organization_id)
  on conflict (user_id) do update set last_organization_id = excluded.last_organization_id, updated_at = now();

  select * into org from public.organizations o where o.id = inv.organization_id;
  return org;
end;
$$;

-- ------------------------------------------------------------
-- RPC : retirer un membre (propriétaire ou admin), ou quitter l'agence soi-même
-- ------------------------------------------------------------
create function public.remove_member(org uuid, member uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  target_role public.org_role;
begin
  select m.role into target_role from public.memberships m
  where m.organization_id = org and m.user_id = member;
  if target_role is null then
    raise exception 'not_member' using errcode = '22023';
  end if;

  if member <> uid then
    if not public.has_org_role(org, array['owner', 'admin']::public.org_role[]) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    -- Un admin ne peut pas retirer un propriétaire.
    if target_role = 'owner' and not public.has_org_role(org, array['owner']::public.org_role[]) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  if target_role = 'owner' and (
    select count(*) from public.memberships m where m.organization_id = org and m.role = 'owner'
  ) = 1 then
    raise exception 'last_owner' using errcode = '22023';
  end if;

  delete from public.memberships m where m.organization_id = org and m.user_id = member;
end;
$$;

-- ------------------------------------------------------------
-- Inscription : profil + première agence, créés automatiquement
-- ------------------------------------------------------------
create function public.bootstrap_user(u auth.users)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  display_name text := coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    split_part(u.email, '@', 1)
  );
  org_id uuid;
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (u.id, lower(u.email), display_name, u.raw_user_meta_data ->> 'avatar_url');

  insert into public.organizations (name, slug, created_by)
  values ('Agence ' || display_name, public.unique_org_slug('agence-' || display_name), u.id)
  returning id into org_id;

  insert into public.memberships (organization_id, user_id, role) values (org_id, u.id, 'owner');
  insert into public.user_preferences (user_id, last_organization_id) values (u.id, org_id);
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.bootstrap_user(new);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Garde l'email du profil synchronisé avec celui du compte.
create function public.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email), updated_at = now() where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Comptes créés avant cette migration : même traitement qu'à l'inscription.
do $$
declare
  u auth.users;
begin
  for u in select * from auth.users au where not exists (select 1 from public.profiles p where p.id = au.id) loop
    perform public.bootstrap_user(u);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.user_preferences enable row level security;
alter table public.mcp_connections enable row level security;

-- Profils : le sien, et ceux des membres de ses agences.
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_org_with(id));
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Agences : visibles par leurs membres, modifiables par propriétaires et admins.
create policy "organizations_select" on public.organizations for select to authenticated
  using (public.is_org_member(id));
create policy "organizations_update" on public.organizations for update to authenticated
  using (public.has_org_role(id, array['owner', 'admin']::public.org_role[]))
  with check (public.has_org_role(id, array['owner', 'admin']::public.org_role[]));

-- Membres : visibles par les membres de l'agence. Écritures uniquement via RPC.
create policy "memberships_select" on public.memberships for select to authenticated
  using (public.is_org_member(organization_id));

-- Invitations : gérées par propriétaires et admins. Création et acceptation via RPC.
create policy "invitations_select" on public.invitations for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]));
create policy "invitations_delete" on public.invitations for delete to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]));

-- Préférences : uniquement les siennes, et seulement vers une agence dont on est membre.
create policy "user_preferences_select" on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy "user_preferences_insert" on public.user_preferences for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (last_organization_id is null or public.is_org_member(last_organization_id))
  );
create policy "user_preferences_update" on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (last_organization_id is null or public.is_org_member(last_organization_id))
  );

-- Connexions MCP : uniquement les siennes, agence par défaut dont on est membre.
create policy "mcp_connections_select" on public.mcp_connections for select to authenticated
  using (user_id = (select auth.uid()));
create policy "mcp_connections_insert" on public.mcp_connections for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (default_organization_id is null or public.is_org_member(default_organization_id))
  );
create policy "mcp_connections_update" on public.mcp_connections for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (default_organization_id is null or public.is_org_member(default_organization_id))
  );

-- ------------------------------------------------------------
-- Droits : rien pour anon, fonctions réservées aux utilisateurs connectés
-- ------------------------------------------------------------
revoke all on public.profiles, public.organizations, public.memberships, public.invitations,
  public.user_preferences, public.mcp_connections from anon;

revoke execute on function
  public.is_org_member(uuid),
  public.has_org_role(uuid, public.org_role[]),
  public.shares_org_with(uuid),
  public.unique_org_slug(text),
  public.create_organization(text),
  public.create_invitation(uuid, text, public.org_role),
  public.get_invitation(uuid),
  public.accept_invitation(uuid),
  public.remove_member(uuid, uuid),
  public.bootstrap_user(auth.users),
  public.handle_new_user(),
  public.handle_user_email_change()
from public, anon, authenticated;

grant execute on function
  public.is_org_member(uuid),
  public.has_org_role(uuid, public.org_role[]),
  public.shares_org_with(uuid),
  public.create_organization(text),
  public.create_invitation(uuid, text, public.org_role),
  public.get_invitation(uuid),
  public.accept_invitation(uuid),
  public.remove_member(uuid, uuid)
to authenticated;
