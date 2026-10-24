-- Tests de sécurité de 0001_organizations (RLS et RPC). Chaque ligne === annonce le résultat attendu.
\set ON_ERROR_STOP off
\pset pager off
\echo === inscription de 3 utilisateurs
insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','alice@ex.fr','{"full_name":"Élodie Dupont"}'),
 ('22222222-2222-2222-2222-222222222222','Bob@ex.fr','{}'),
 ('33333333-3333-3333-3333-333333333333','carol@ex.fr','{}');
select o.name, o.slug, m.role, p.email from public.organizations o join public.memberships m on m.organization_id=o.id join public.profiles p on p.id=m.user_id order by o.slug;

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;

set role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
\echo === alice voit ses agences (1 attendue)
select name from public.organizations;
\echo === alice cree une 2e agence
select slug from public.create_organization('Studio Élodie');
select slug from public.create_organization('Studio Élodie');
select count(*) as nb_agences_alice from public.organizations;
\echo === alice invite bob en admin sur studio-elodie
select email, role from public.create_invitation((select id from public.organizations where slug='studio-elodie'), ' BOB@ex.fr ', 'admin');
\echo === invitation owner interdite (erreur attendue)
select public.create_invitation((select id from public.organizations where slug='studio-elodie'), 'x@ex.fr', 'owner');

\echo === carol ne voit rien de alice ni les invitations, et ne peut pas inviter (erreur attendue)
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select count(*) as orgs_visibles_carol from public.organizations;
select count(*) as invits_visibles_carol from public.invitations;
select public.create_invitation((select id from public.organizations where slug='studio-elodie'), 'z@ex.fr');
\echo === carol ne peut pas accepter l invitation de bob (email_mismatch attendu)
reset role;
select token as tok from public.invitations where email='bob@ex.fr' \gset
set role authenticated;
select public.accept_invitation(:'tok');
\echo === carol ne peut pas pointer ses preferences sur une agence de alice (erreur RLS attendue)
update public.user_preferences set last_organization_id=(select id from public.organizations where slug='studio-elodie' limit 1);
reset role;
select count(*) as carol_pref_alterees from public.user_preferences where user_id='33333333-3333-3333-3333-333333333333' and last_organization_id=(select id from public.organizations where slug='studio-elodie');
set role authenticated;

\echo === bob lit puis accepte
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select * from public.get_invitation(:'tok');
select slug from public.accept_invitation(:'tok');
select * from public.get_invitation(:'tok');
\echo === re-accepter (invitation_invalid attendu)
select public.accept_invitation(:'tok');
\echo === bob voit 2 agences et les membres de studio-elodie
select slug from public.organizations order by slug;
select p.email, m.role from public.memberships m join public.profiles p on p.id=m.user_id where m.organization_id=(select id from public.organizations where slug='studio-elodie') order by 1;
\echo === bob (admin) ne peut pas retirer alice (owner) : forbidden attendu
select public.remove_member((select id from public.organizations where slug='studio-elodie'), '11111111-1111-1111-1111-111111111111');
\echo === insert direct dans memberships interdit (erreur RLS attendue)
insert into public.memberships values ((select id from public.organizations where slug='studio-elodie'), '33333333-3333-3333-3333-333333333333', 'owner');
\echo === alice ne peut pas quitter si derniere owner (last_owner attendu)
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.remove_member((select id from public.organizations where slug='studio-elodie'), '11111111-1111-1111-1111-111111111111');
\echo === alice retire bob : ok
select public.remove_member((select id from public.organizations where slug='studio-elodie'), '22222222-2222-2222-2222-222222222222');
select count(*) as membres_restants from public.memberships where organization_id=(select id from public.organizations where slug='studio-elodie');
\echo === mcp_connections : alice choisit studio-elodie ok, puis agence de carol refusee
insert into public.mcp_connections (user_id, oauth_client_id, default_organization_id) values ('11111111-1111-1111-1111-111111111111','claude',(select id from public.organizations where slug='studio-elodie'));
reset role;
select id as carol_org from public.organizations where created_by='33333333-3333-3333-3333-333333333333' \gset
set role authenticated;
update public.mcp_connections set default_organization_id=:'carol_org' where oauth_client_id='claude';
\echo === anon ne voit rien et ne peut rien executer
reset role; set role anon;
select count(*) from public.organizations;
select public.create_organization('pirate');
reset role;
\echo === sync email
update auth.users set email='Bobby@ex.fr' where id='22222222-2222-2222-2222-222222222222';
select email from public.profiles where id='22222222-2222-2222-2222-222222222222';
