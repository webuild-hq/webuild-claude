---
name: webuild-store-builder
description: Construire une boutique Shopify premium avec les thèmes Webuild. À utiliser dès que l'utilisateur veut créer, refaire ou habiller une boutique Shopify avec Webuild, installer un thème Webuild, remplir ses sections ou générer les images d'une boutique. Nécessite le connecteur Webuild et le connecteur Shopify.
---

# Construire une boutique avec Webuild

Webuild fournit des thèmes Shopify premium (outils MCP Webuild) ; le connecteur Shopify officiel fait toutes les
modifications sur la boutique. Webuild n'a jamais accès à la boutique.

## Règles

- **Ne publie jamais un thème sans validation explicite de l'utilisateur.** Le thème est toujours créé en brouillon
  (`role: UNPUBLISHED`) et l'utilisateur valide l'aperçu avant `themePublish`.
- **Annonce le coût avant les actions payantes** (installation de thème, images). Consulte `get_account_status` si
  plusieurs actions s'enchaînent.
- **Plusieurs agences** : si `list_my_agencies` renvoie plusieurs agences et que l'utilisateur n'a rien précisé,
  demande laquelle utiliser et passe son slug dans `agency`.
- **Images** : uniquement pour l'ambiance (hero, bannières, éditorial, lifestyle). Ne remplace jamais les vraies
  photos des produits par des images générées.
- Ne modifie pas `snippets/webuild-license.liquid` ni ses appels dans `layout/` : c'est la licence du thème.

## Déroulé

1. **Contexte** : `list_my_agencies`, puis récupère le domaine permanent de la boutique avec le connecteur Shopify
   (`shop { myshopifyDomain name }`).
2. **Brief** : marque, cible, produits, ton, couleurs, pages attendues. Pose les questions manquantes en une fois.
3. **Choix du thème** : `list_themes`, propose 1 ou 2 thèmes adaptés en expliquant pourquoi.
4. **Installation** : `prepare_theme_install(theme, shop_domain)` renvoie un lien de zip valable 1 heure.
   - `themeCreate(source: <downloadUrl>, name: "<Thème> (Webuild)", role: UNPUBLISHED)`
   - Interroge `theme(id) { processing processingFailed }` jusqu'à `processing: false`.
5. **Structure** : `get_theme_guide(theme)` pour les templates et sections, puis `get_theme_guide(theme, section)`
   pour les réglages précis d'une section avant de l'écrire.
6. **Contenu** : lis les fichiers existants (`theme { files(filenames: ["templates/index.json"]) }`), puis écris
   avec `themeFilesUpsert` : `templates/index.json`, `templates/product.json`, pages, `config/settings_data.json`
   (couleurs, typographies). Respecte les identifiants de réglages du guide ; les valeurs inconnues sont ignorées
   par Shopify ou font échouer l'écriture.
7. **Images** : pour chaque emplacement `image_picker` utile, `generate_section_image(theme, section, setting,
   brief)`, puis `fileCreate(files: { originalSource, filename, contentType: IMAGE, alt })`, attends `fileStatus:
   READY`, et mets `"shopify://shop_images/<filename>"` comme valeur du réglage.
8. **Aperçu** : donne `https://<domaine>/?preview_theme_id=<id>` et un résumé de ce qui a été fait.
9. **Publication** : après validation explicite, `themePublish(id)`.

## En cas de problème

- **Crédits insuffisants** : explique le solde et le coût, et renvoie vers la page Abonnement du dashboard Webuild.
- **Lien expiré** : rappelle `prepare_theme_install` (gratuit pour la même boutique et la même version).
- **`processingFailed`** : signale-le, supprime le thème en échec (`themeDelete`) et recommence l'installation.
