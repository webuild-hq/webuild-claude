-- ============================================================
-- Webuild pour Claude : images déposées par l'utilisateur dans Supabase Storage
-- À exécuter après 0004_theme_deliveries_bucket.sql.
-- ============================================================
-- Une image jointe à la conversation ne peut pas être transmise à Shopify par Claude. L'utilisateur la dépose
-- donc dans la zone de dépôt Webuild affichée dans Claude : le navigateur l'envoie ici avec un lien d'envoi
-- signé créé par le serveur, puis Claude l'importe dans la boutique avec fileCreate depuis son URL publique.
-- Bucket public (Shopify doit pouvoir télécharger l'image), dossier = identifiant de l'agence, noms de fichier
-- non devinables. Aucune policy : seul service_role écrit et liste, après vérification de l'appartenance.

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'client-images',
      'client-images',
      true,
      20971520,
      array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
    )
    on conflict (id) do nothing;
  end if;
end;
$$;
