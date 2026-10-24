-- Tests de 0002 (crédits, plans, livraisons, places). Chaque ligne === annonce le résultat attendu.
\set ON_ERROR_STOP off
\pset pager off
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;

\echo === inscription : agence + 1000 credits de bienvenue
insert into auth.users (id, email) values
 ('aaaaaaaa-0000-0000-0000-000000000001','ana@ex.fr'),
 ('bbbbbbbb-0000-0000-0000-000000000002','ben@ex.fr');
select o.slug, public.credit_balance(o.id) as solde from public.organizations o where o.created_by in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002') order by 1;
select id as ana_org from public.organizations where slug='agence-ana' \gset
select id as ben_org from public.organizations where slug='agence-ben' \gset

set role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
\echo === ana : une 2e agence n a pas de credits de bienvenue (0 attendu)
select slug from public.create_organization('Seconde');
select public.credit_balance(id) as solde_seconde from public.organizations where slug = 'seconde';
\echo === ana livre skeleton sur sa boutique : 200 debites, solde 800
select myshopify_domain, theme_slug, credits_charged, reused, length(license_salt) as salt_len from public.create_delivery(:'ana_org', 'Ma-Boutique.myshopify.com', 'skeleton', '1.0.0');
select public.credit_balance(:'ana_org') as solde;
\echo === meme livraison : gratuite (reused = t), solde inchange
select credits_charged, reused from public.create_delivery(:'ana_org', 'ma-boutique.myshopify.com', 'skeleton', '1.0.0');
select public.credit_balance(:'ana_org') as solde;
\echo === empreinte = sha256(domaine:salt)
select (license_hash = encode(sha256(convert_to('ma-boutique.myshopify.com:' || license_salt, 'UTF8')), 'hex')) as empreinte_ok from public.deliveries;
\echo === domaine invalide refuse (invalid_shop_domain)
select * from public.create_delivery(:'ana_org', 'ma-boutique.com', 'skeleton', '1.0.0');
\echo === ana ne peut pas livrer pour l agence de ben (forbidden)
select * from public.create_delivery(:'ben_org', 'x.myshopify.com', 'skeleton', '1.0.0');
\echo === ana ne lit pas le solde de ben (forbidden)
select public.credit_balance(:'ben_org');
\echo === image : debit de 50, et la meme cle ne debite pas deux fois (solde 750)
select amount from public.consume_credits(:'ana_org', 'image_generation', 'img-1');
select amount from public.consume_credits(:'ana_org', 'image_generation', 'img-1');
select public.credit_balance(:'ana_org') as solde_apres_image;
\echo === remboursement unique de l image, par le serveur (service_role, depuis 0003)
select id as img_tx from public.credit_transactions where idempotency_key like '%img-1' \gset
reset role; set role service_role;
select amount, reason from public.refund_credits(:'img_tx');
select amount, reason from public.refund_credits(:'img_tx');
reset role; set role authenticated;
select public.credit_balance(:'ana_org') as solde_apres_remboursement;
\echo === credits insuffisants : 5 livraisons de 200 avec 800, tout est annule (insufficient_credits, solde 800)
select count(*) from (select public.create_delivery(:'ana_org', 'shop' || g || '.myshopify.com', 'skeleton', '1.0.0') from generate_series(1,5) g) x;
select public.credit_balance(:'ana_org') as solde_final;
\echo === ana ne peut pas se crediter (permission denied)
select public.grant_credits(:'ana_org', 99999, 'manual', 'triche', 'x');
\echo === ana ne peut pas ecrire dans credit_transactions directement (RLS)
insert into public.credit_transactions (organization_id, amount, reason, idempotency_key) values (:'ana_org', 5000, 'manual', 'triche');
\echo === ana ne voit que ses livraisons et transactions
select count(*) as livraisons_visibles from public.deliveries;
select count(distinct organization_id) as agences_dans_transactions from public.credit_transactions;
\echo === limite de places du plan gratuit (3) : 2 invitations ok, la 3e refusee (seat_limit)
select email from public.create_invitation(:'ana_org', 'i1@ex.fr');
select email from public.create_invitation(:'ana_org', 'i2@ex.fr');
select email from public.create_invitation(:'ana_org', 'i3@ex.fr');

reset role;
\echo === serveur (service_role) : credit d abonnement idempotent
set role service_role;
select amount from public.grant_credits(:'ana_org', 2000, 'subscription', 'Abonnement Starter', 'invoice:in_1');
select amount from public.grant_credits(:'ana_org', 2000, 'subscription', 'Abonnement Starter', 'invoice:in_1');
select public.credit_balance(:'ana_org') as solde_apres_abonnement;
\echo === plan pro actif : 10 places, la 3e invitation passe
insert into public.subscriptions (organization_id, plan_id, status) values (:'ana_org', 'pro', 'active');
reset role;
set role authenticated;
select (public.org_plan(:'ana_org')).name as plan;
select email from public.create_invitation(:'ana_org', 'i3@ex.fr');
\echo === anon ne voit que les plans publics
reset role; set role anon;
select count(*) as plans_publics from public.plans;
select count(*) from public.credit_transactions;
reset role;
