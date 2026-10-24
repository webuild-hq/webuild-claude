-- Tests de 0003 (remboursements réservés au serveur). Chaque ligne === annonce le résultat attendu.
-- S'appuie sur les données créées par le test de 0002 (agence-ana, sa livraison skeleton).
\set ON_ERROR_STOP off
\pset pager off
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;

select id as ana_org from public.organizations where slug='agence-ana' \gset
select id as delivery_tx from public.credit_transactions
  where organization_id = :'ana_org' and reason = 'theme_install' order by created_at limit 1 \gset

set role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.credit_balance(:'ana_org') as solde_avant \gset
\echo === ana ne peut pas rembourser sa livraison reussie (permission denied)
select public.refund_credits(:'delivery_tx');
\echo === ana ne peut pas rembourser un debit d image qu elle vient de faire (permission denied)
select id as img2_tx from public.consume_credits(:'ana_org', 'image_generation', 'img-2') \gset
select public.refund_credits(:'img2_tx');
\echo === solde : seul le debit de l image (50) a ete pris (t)
select public.credit_balance(:'ana_org') = :solde_avant - 50 as solde_ok;

reset role; set role anon;
\echo === anon ne peut pas rembourser (permission denied)
select public.refund_credits(:'img2_tx');

reset role; set role service_role;
\echo === le serveur rembourse l image, attribuee a ana (50, refund, t)
select amount, reason, user_id = 'aaaaaaaa-0000-0000-0000-000000000001' as auteur_ok from public.refund_credits(:'img2_tx', 'Image non generee');
\echo === un credit ne se rembourse pas (not_refundable)
select id as welcome_tx from public.credit_transactions where organization_id = :'ana_org' and reason = 'welcome' \gset
select public.refund_credits(:'welcome_tx');
\echo === transaction inconnue (not_found)
select public.refund_credits('00000000-0000-0000-0000-000000000000');
reset role;
