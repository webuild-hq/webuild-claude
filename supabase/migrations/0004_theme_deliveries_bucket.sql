-- ============================================================
-- Webuild pour Claude : zips des thèmes livrés dans Supabase Storage
-- À exécuter après 0003_server_only_refunds.sql.
-- ============================================================
-- themeCreate refuse les zips servis par la route Vercel ("Src is empty") alors qu'il accepte un CDN.
-- Le serveur dépose donc le zip verrouillé de chaque livraison dans ce bucket privé (clé secrète) et
-- donne à Shopify un lien signé de courte durée. Aucune policy : seul service_role lit et écrit.

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('theme-deliveries', 'theme-deliveries', false, 52428800, array['application/zip'])
    on conflict (id) do nothing;
  end if;
end;
$$;
