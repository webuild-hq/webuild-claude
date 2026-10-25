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
- **Disposition des sections** : à la première création de la boutique, garde la disposition livrée avec le thème.
  Mêmes sections, dans le même ordre, avec les mêmes blocs, sur chaque template (accueil, produit, collection...).
  Ton travail est de les remplir (textes, images, produits, couleurs), pas de les recomposer. Ne supprime, n'ajoute,
  ne déplace et ne masque une section ou un bloc que si l'utilisateur le demande. Si une section te semble inutile
  pour la marque, remplis-la quand même et propose le changement dans le résumé.
- **Images : remplis tous les emplacements.** Chaque section affichée doit avoir ses images : une section sans image
  casse le rendu du thème. La liste à remplir est dans `get_theme_guide`, champ `imageSlots` de chaque section des
  templates. Seule exception : les logos de `press-quotes`, à laisser vides tant que l'utilisateur ne fournit pas
  de vrais logos.
- **Réutilise les images** : tu n'as pas besoin d'une image différente par emplacement. Génère un petit jeu
  d'images (par exemple 4 à 8 : hero, ambiance, gros plan produit, texture, lifestyle) et réutilise chacune autant
  de fois que nécessaire, une même image pouvant servir à 10 endroits. Les photos produits de la boutique (`product
  { media }`, `files`) peuvent aussi remplir les emplacements. Varie seulement les images d'une même section quand
  elles sont côte à côte (cartes, carrousel, bandeau défilant).
- **Images du client d'abord** : beaucoup de marques préfèrent leurs propres photos (shooting, photos clients,
  lifestyle). Demande-le au brief. Si l'utilisateur fournit ses images, utilise-les en priorité sur tous les
  emplacements et ne génère que pour compléter, avec son accord. S'il refuse les images IA, n'en génère aucune.
  Pour les récupérer :
  - par défaut, affiche la zone de dépôt Webuild (`upload_client_images`) : il y glisse ses images, puis clique
    sur "Utiliser ces images" et valide le message proposé. Leurs URL sont dans ton contexte, sinon
    `list_client_images` les donne. Importe chacune avec `fileCreate(files: { originalSource:
    <url>, filename, contentType: IMAGE })` ; `list_client_images` retrouve celles déposées avant ;
  - s'il les a déjà mises dans Shopify (admin, Contenu > Fichiers), lis-les avec `files(query:
    "media_type:IMAGE")` et utilise `"shopify://shop_images/<filename>"` ;
  - s'il donne des liens directs vers les images (son site, un stockage public), importe-les avec `fileCreate`.
  Une image jointe à la conversation ne peut pas être envoyée à Shopify : propose la zone de dépôt. Seule
  exception : si l'exécution de code est active avec un accès réseau au stockage de Shopify, tu peux l'envoyer
  depuis ton environnement (`stagedUploadsCreate`, envoi du fichier, puis `fileCreate` avec la `resourceUrl`).
- **Sans génération d'images** (crédits insuffisants, génération pas activée, ou l'utilisateur n'en veut pas) :
  dis-le à l'utilisateur, puis remplis quand même tous les emplacements avec les images déjà disponibles : photos
  des produits de la boutique, images fournies par l'utilisateur, images récupérées avec les produits importés
  (AliExpress ou autre source). Une seule image réutilisée partout vaut mieux qu'une section vide. Si la boutique
  n'a encore aucune image, demande-en une à l'utilisateur ou propose d'importer d'abord un produit.
- **Images générées** : uniquement pour l'ambiance (hero, bannières, éditorial, lifestyle). Ne remplace jamais les
  vraies photos des produits par des images générées. Pour la photo d'un avis client, mets une image produit ou
  d'ambiance, jamais un visage inventé.
- **Avis clients, témoignages, citations presse, notes** : n'invente jamais un avis présenté comme réel. Utilise les
  avis et citations fournis par l'utilisateur. S'il n'en a pas, remplis la section avec des exemples clairement
  marqués (auteur "Prénom N. (exemple)", texte qui dit qu'il est à remplacer), sans logo ni nom de média réel, et
  signale ces sections dans le résumé : l'agence doit les remplacer ou les masquer avant la publication.
- Ne modifie pas `snippets/webuild-license.liquid` ni ses appels dans `layout/` : c'est la licence du thème.

## Déroulé

1. **Contexte** : `list_my_agencies`, puis récupère le domaine permanent de la boutique avec le connecteur Shopify
   (`shop { myshopifyDomain name }`).
2. **Brief** : marque, cible, produits, ton, couleurs, pages attendues, et images (ses propres photos, images IA,
   ou les deux). Pose les questions manquantes en une fois.
3. **Choix du thème** : `list_themes`, propose 1 ou 2 thèmes adaptés en expliquant pourquoi.
4. **Installation** : `prepare_theme_install(theme, shop_domain)` renvoie un lien de zip valable 1 heure.
   - `themeCreate(source: <downloadUrl>, name: "<Thème> (Webuild)", role: UNPUBLISHED)`
   - Interroge `theme(id) { processing processingFailed }` jusqu'à `processing: false`.
5. **Structure** : `get_theme_guide(theme)` pour les templates et sections, puis `get_theme_guide(theme, section)`
   pour les réglages précis d'une section avant de l'écrire.
6. **Contenu** : lis les fichiers livrés (`theme { files(filenames: ["templates/index.json"]) }`) et pars d'eux :
   change les valeurs des réglages et des blocs, garde `order`, les sections et les blocs tels quels (voir
   Disposition). Écris avec `themeFilesUpsert` : `templates/index.json`, `templates/product.json`, les autres
   templates, `config/settings_data.json` (couleurs, typographies). Respecte les identifiants de réglages du guide ;
   les valeurs inconnues sont ignorées par Shopify ou font échouer l'écriture.
7. **Images** :
   - Fais la liste de tous les `imageSlots` des templates que tu remplis.
   - Commence par les images du client s'il en a (voir Images du client d'abord).
   - Pour compléter, génère le petit jeu d'images avec `generate_section_image(theme, section, setting, brief)` (une
     génération par image du jeu, pas par emplacement), puis `fileCreate(files: { originalSource, filename,
     contentType: IMAGE, alt })` et attends `fileStatus: READY`.
   - Si la génération est impossible, prends les images déjà dans la boutique (`files(query: "media_type:IMAGE")`,
     `product { media }`) ou celles des produits importés (voir Sans génération d'images).
   - Répartis le jeu sur tous les emplacements : la valeur du réglage est `"shopify://shop_images/<filename>"`.
   - Avant l'aperçu, vérifie qu'aucun emplacement n'est vide (hors logos presse).
8. **Aperçu** : donne `https://<domaine>/?preview_theme_id=<id>` et un résumé de ce qui a été fait, avec la liste
   des sections qui contiennent encore des exemples à remplacer (avis, citations) et tes éventuelles propositions de
   changement de disposition.
9. **Publication** : après validation explicite, `themePublish(id)`. S'il reste des exemples d'avis ou de
   citations, rappelle-le avant de publier et demande confirmation.

## Modifications demandées après la création

Quand l'utilisateur demande de changer la disposition (retirer, ajouter, déplacer une section, changer un bloc),
fais-le, uniquement sur ce qu'il a demandé, et laisse le reste intact. Une nouvelle section doit être remplie comme
les autres, images comprises.

## En cas de problème

- **Crédits insuffisants** : explique le solde et le coût, et renvoie vers la page Abonnement du dashboard Webuild.
  Pour les images, ne t'arrête pas là : remplis les emplacements avec les images existantes (voir Sans génération
  d'images) et propose de les remplacer par des images générées plus tard.
- **Génération d'images pas activée** : même chose, préviens l'utilisateur et remplis avec les images existantes.
- **Lien expiré** : rappelle `prepare_theme_install` (gratuit pour la même boutique et la même version).
- **`processingFailed`** : signale-le, supprime le thème en échec (`themeDelete`) et recommence l'installation.
