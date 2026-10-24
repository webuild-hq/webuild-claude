-- ============================================================
-- 0002 : plans, abonnements, crédits, boutiques, livraisons, images
-- ============================================================
-- Les crédits sont un registre de transactions : le solde est la somme.
-- Les écritures passent par des fonctions qui vérifient les droits et évitent les doubles débits.

-- ------------------------------------------------------------
-- Plans et abonnements (Stripe)
-- ------------------------------------------------------------
create table public.plans (
  id text primary key,
  name text not null,
  monthly_credits int not null check (monthly_credits >= 0),
  max_members int not null check (max_members >= 1),
  price_cents int not null check (price_cents >= 0),
  currency text not null default 'eur',
  sort int not null default 0,
  is_public boolean not null default true
);

-- Valeurs provisoires, à ajuster une fois les coûts mesurés.
insert into public.plans (id, name, monthly_credits, max_members, price_cents, sort) values
  ('free', 'Gratuit', 0, 3, 0, 0),
  ('starter', 'Starter', 2000, 3, 4900, 1),
  ('pro', 'Pro', 6000, 10, 14900, 2),
  ('agency', 'Agence', 20000, 50, 39900, 3);

create table public.subscriptions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  plan_id text not null references public.plans (id) default 'free',
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Plan effectif d'une agence : celui de l'abonnement s'il est actif, sinon le plan gratuit.
create function public.org_plan(org uuid)
returns public.plans
language sql stable security definer set search_path = ''
as $$
  select p.* from public.plans p
  where p.id = coalesce(
    (select s.plan_id from public.subscriptions s
     where s.organization_id = org and s.status in ('active', 'trialing', 'past_due')),
    'free'
  );
$$;

-- ------------------------------------------------------------
-- Crédits
-- ------------------------------------------------------------
create table public.credit_prices (
  action text primary key,
  credits int not null check (credits >= 0),
  label text not null,
  updated_at timestamptz not null default now()
);

-- Valeurs provisoires, à ajuster une fois les coûts mesurés.
insert into public.credit_prices (action, credits, label) values
  ('theme_install', 200, 'Installation d''un thème sur une boutique'),
  ('image_generation', 50, 'Image générée pour une section');

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  amount int not null,
  reason text not null
    check (reason in ('welcome', 'subscription', 'top_up', 'manual', 'refund', 'theme_install', 'image_generation')),
  description text,
  reference_type text,
  reference_id text,
  idempotency_key text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  provider_cost_cents int,
  created_at timestamptz not null default now()
);
create index credit_transactions_org_idx on public.credit_transactions (organization_id, created_at desc);

create function public.credit_balance(org uuid)
returns int
language plpgsql stable security definer set search_path = ''
as $$
begin
  -- Les utilisateurs ne lisent que le solde de leurs agences ; le serveur (sans utilisateur) lit tout.
  if (select auth.uid()) is not null and not public.is_org_member(org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((select sum(t.amount) from public.credit_transactions t where t.organization_id = org), 0);
end;
$$;

-- Débite le prix d'une action. Une même clé ne débite qu'une fois. La clé est préfixée par l'agence :
-- un utilisateur ne peut pas occuper la clé d'une autre agence ni celle d'un crédit (préfixe grant:).
create function public.consume_credits(
  org uuid,
  credit_action text,
  idempotency text,
  ref_type text default null,
  ref_id text default null,
  details text default null
)
returns public.credit_transactions
language plpgsql volatile security definer set search_path = ''
as $$
declare
  key text := 'consume:' || org || ':' || idempotency;
  existing public.credit_transactions;
  price int;
  balance int;
  tx public.credit_transactions;
begin
  if not public.is_org_member(org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into existing from public.credit_transactions t where t.idempotency_key = key;
  if existing.id is not null then
    return existing;
  end if;

  select p.credits into price from public.credit_prices p where p.action = credit_action;
  if price is null then
    raise exception 'unknown_action' using errcode = '22023';
  end if;

  -- Verrou par agence : deux débits simultanés ne peuvent pas passer sous zéro.
  perform 1 from public.organizations o where o.id = org for update;
  balance := coalesce((select sum(t.amount) from public.credit_transactions t where t.organization_id = org), 0);
  if balance < price then
    raise exception 'insufficient_credits' using errcode = 'P0001',
      detail = format('balance=%s price=%s', balance, price);
  end if;

  insert into public.credit_transactions
    (organization_id, amount, reason, description, reference_type, reference_id, idempotency_key, user_id)
  values (org, -price, credit_action, details, ref_type, ref_id, key, (select auth.uid()))
  on conflict (idempotency_key) do nothing
  returning * into tx;

  if tx.id is null then
    select * into tx from public.credit_transactions t where t.idempotency_key = key;
  end if;
  return tx;
end;
$$;

-- Rembourse un débit (par exemple une image dont la génération a échoué). Une seule fois par débit.
create function public.refund_credits(transaction_id uuid, details text default null)
returns public.credit_transactions
language plpgsql volatile security definer set search_path = ''
as $$
declare
  original public.credit_transactions;
  tx public.credit_transactions;
begin
  select * into original from public.credit_transactions t where t.id = transaction_id;
  if original.id is null or not public.is_org_member(original.organization_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if original.amount >= 0 then
    raise exception 'not_refundable' using errcode = '22023';
  end if;

  insert into public.credit_transactions
    (organization_id, amount, reason, description, reference_type, reference_id, idempotency_key, user_id)
  values (original.organization_id, -original.amount, 'refund', coalesce(details, 'Remboursement'),
    'credit_transaction', original.id::text, 'refund:' || original.id, (select auth.uid()))
  on conflict (idempotency_key) do nothing
  returning * into tx;

  if tx.id is null then
    select * into tx from public.credit_transactions t where t.idempotency_key = 'refund:' || original.id;
  end if;
  return tx;
end;
$$;

-- Crédite une agence (abonnement Stripe, recharge, geste commercial). Réservé au serveur.
create function public.grant_credits(org uuid, credit_amount int, credit_reason text, details text, idempotency text)
returns public.credit_transactions
language plpgsql volatile security definer set search_path = ''
as $$
declare
  key text := 'grant:' || idempotency;
  tx public.credit_transactions;
begin
  insert into public.credit_transactions (organization_id, amount, reason, description, idempotency_key)
  values (org, credit_amount, credit_reason, details, key)
  on conflict (idempotency_key) do nothing
  returning * into tx;

  if tx.id is null then
    select * into tx from public.credit_transactions t where t.idempotency_key = key;
  end if;
  return tx;
end;
$$;

-- ------------------------------------------------------------
-- Boutiques et livraisons de thèmes (licences)
-- ------------------------------------------------------------
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  myshopify_domain text not null check (myshopify_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'),
  name text,
  client_id uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, myshopify_domain)
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  theme_slug text not null,
  theme_version text not null,
  license_salt text not null,
  license_hash text not null,
  created_by uuid references auth.users (id) on delete set null,
  credit_transaction_id uuid references public.credit_transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (shop_id, theme_slug, theme_version)
);
create index deliveries_org_idx on public.deliveries (organization_id, created_at desc);

-- Livre un thème pour une boutique : débite les crédits la première fois, gratuit ensuite (même version).
create function public.create_delivery(org uuid, shop_domain text, theme text, version text)
returns table (
  id uuid,
  shop_id uuid,
  myshopify_domain text,
  theme_slug text,
  theme_version text,
  license_salt text,
  license_hash text,
  credits_charged int,
  reused boolean,
  created_at timestamptz
)
language plpgsql volatile security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  domain text := lower(trim(shop_domain));
  shop uuid;
  delivery public.deliveries;
  tx public.credit_transactions;
  salt text;
begin
  if not public.is_org_member(org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if domain !~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$' then
    raise exception 'invalid_shop_domain' using errcode = '22023';
  end if;

  insert into public.shops (organization_id, myshopify_domain) values (org, domain)
  on conflict (organization_id, myshopify_domain) do nothing;
  select s.id into shop from public.shops s where s.organization_id = org and s.myshopify_domain = domain;

  select * into delivery from public.deliveries d
  where d.shop_id = shop and d.theme_slug = theme and d.theme_version = version;
  if delivery.id is not null then
    return query select delivery.id, shop, domain, delivery.theme_slug, delivery.theme_version,
      delivery.license_salt, delivery.license_hash, 0, true, delivery.created_at;
    return;
  end if;

  tx := public.consume_credits(org, 'theme_install',
    'delivery:' || shop || ':' || theme || ':' || version, 'shop', shop::text,
    'Thème ' || theme || ' ' || version || ' pour ' || domain);

  salt := replace(gen_random_uuid()::text, '-', '');
  insert into public.deliveries
    (organization_id, shop_id, theme_slug, theme_version, license_salt, license_hash, created_by, credit_transaction_id)
  values (org, shop, theme, version, salt,
    encode(sha256(convert_to(domain || ':' || salt, 'UTF8')), 'hex'), (select auth.uid()), tx.id)
  on conflict on constraint deliveries_shop_id_theme_slug_theme_version_key do nothing
  returning * into delivery;

  -- Appel concurrent : l'autre a créé la livraison (et le débit idempotent n'a compté qu'une fois).
  if delivery.id is null then
    select * into delivery from public.deliveries d
    where d.shop_id = shop and d.theme_slug = theme and d.theme_version = version;
    return query select delivery.id, shop, domain, delivery.theme_slug, delivery.theme_version,
      delivery.license_salt, delivery.license_hash, 0, true, delivery.created_at;
    return;
  end if;

  return query select delivery.id, shop, domain, delivery.theme_slug, delivery.theme_version,
    delivery.license_salt, delivery.license_hash, -tx.amount, false, delivery.created_at;
end;
$$;

-- ------------------------------------------------------------
-- Images générées
-- ------------------------------------------------------------
create table public.image_generations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shop_id uuid references public.shops (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  theme_slug text,
  section text,
  setting text,
  prompt text not null,
  aspect_ratio text,
  storage_path text,
  public_url text,
  status text not null check (status in ('completed', 'failed')),
  model text,
  error text,
  credit_transaction_id uuid references public.credit_transactions (id) on delete set null,
  provider_cost_cents int,
  created_at timestamptz not null default now()
);
create index image_generations_org_idx on public.image_generations (organization_id, created_at desc);

-- ------------------------------------------------------------
-- Limite de places selon le plan (remplace les fonctions de 0001)
-- ------------------------------------------------------------
create function public.seats_used(org uuid)
returns int
language sql stable security definer set search_path = ''
as $$
  select (select count(*) from public.memberships m where m.organization_id = org)::int
       + (select count(*) from public.invitations i
          where i.organization_id = org and i.accepted_at is null and i.expires_at > now())::int;
$$;

create or replace function public.create_invitation(org uuid, invite_email text, invite_role public.org_role default 'member')
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

  if public.seats_used(org) >= (public.org_plan(org)).max_members then
    raise exception 'seat_limit' using errcode = 'P0001';
  end if;

  insert into public.invitations (organization_id, email, role, invited_by)
  values (org, normalized, invite_role, (select auth.uid()))
  returning * into inv;

  return inv;
end;
$$;

create or replace function public.accept_invitation(invite_token uuid)
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

  if not exists (select 1 from public.memberships m where m.organization_id = inv.organization_id and m.user_id = uid)
     and (select count(*) from public.memberships m where m.organization_id = inv.organization_id)
         >= (public.org_plan(inv.organization_id)).max_members then
    raise exception 'seat_limit' using errcode = 'P0001';
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
-- Crédits de bienvenue : uniquement sur la première agence créée à l'inscription
-- ------------------------------------------------------------
create or replace function public.bootstrap_user(u auth.users)
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

  perform public.grant_credits(org_id, 1000, 'welcome', 'Crédits de bienvenue', 'welcome:' || u.id);
end;
$$;

-- Comptes existants : crédits de bienvenue sur leur première agence.
do $$
declare
  first_org record;
begin
  for first_org in
    select distinct on (o.created_by) o.id, o.created_by
    from public.organizations o
    where o.created_by is not null
    order by o.created_by, o.created_at
  loop
    perform public.grant_credits(first_org.id, 1000, 'welcome', 'Crédits de bienvenue',
      'welcome:' || first_org.created_by);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Stockage des images générées (bucket public, dossier = id de l'agence)
-- ------------------------------------------------------------
create function public.try_uuid(value text)
returns uuid
language plpgsql immutable
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('generated-images', 'generated-images', true)
    on conflict (id) do nothing;

    execute $policy$
      create policy "generated_images_insert" on storage.objects for insert to authenticated
      with check (
        bucket_id = 'generated-images'
        and public.is_org_member(public.try_uuid((storage.foldername(name))[1]))
      )
    $policy$;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.credit_prices enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.shops enable row level security;
alter table public.deliveries enable row level security;
alter table public.image_generations enable row level security;

create policy "plans_select" on public.plans for select to anon, authenticated using (is_public);
create policy "credit_prices_select" on public.credit_prices for select to authenticated using (true);

create policy "subscriptions_select" on public.subscriptions for select to authenticated
  using (public.is_org_member(organization_id));
create policy "credit_transactions_select" on public.credit_transactions for select to authenticated
  using (public.is_org_member(organization_id));
create policy "shops_select" on public.shops for select to authenticated
  using (public.is_org_member(organization_id));
create policy "shops_update" on public.shops for update to authenticated
  using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "deliveries_select" on public.deliveries for select to authenticated
  using (public.is_org_member(organization_id));
create policy "image_generations_select" on public.image_generations for select to authenticated
  using (public.is_org_member(organization_id));
create policy "image_generations_insert" on public.image_generations for insert to authenticated
  with check (public.is_org_member(organization_id) and user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- Droits
-- ------------------------------------------------------------
revoke all on public.subscriptions, public.credit_prices, public.credit_transactions, public.shops,
  public.deliveries, public.image_generations from anon;
revoke insert, update, delete on public.plans from anon, authenticated;

revoke execute on function
  public.org_plan(uuid),
  public.credit_balance(uuid),
  public.consume_credits(uuid, text, text, text, text, text),
  public.refund_credits(uuid, text),
  public.grant_credits(uuid, int, text, text, text),
  public.create_delivery(uuid, text, text, text),
  public.seats_used(uuid),
  public.try_uuid(text)
from public, anon;

revoke execute on function public.grant_credits(uuid, int, text, text, text) from authenticated;

grant execute on function
  public.org_plan(uuid),
  public.credit_balance(uuid),
  public.consume_credits(uuid, text, text, text, text, text),
  public.refund_credits(uuid, text),
  public.create_delivery(uuid, text, text, text),
  public.seats_used(uuid),
  public.try_uuid(text)
to authenticated;

grant execute on function public.grant_credits(uuid, int, text, text, text) to service_role;
