# Webuild pour Claude : architecture

Ce document rassemble les décisions d'architecture du projet. Il sert de référence avant et pendant le développement.

## 1. Vision

Webuild pour Claude est un catalogue de thèmes Shopify premium, pilotable par Claude.

- Une agence ou un freelance connecte deux choses à son Claude : le **connecteur Shopify officiel** (déjà existant) et le **MCP Webuild**.
- Quand l'utilisateur demande à Claude de construire une boutique, Claude utilise les thèmes Webuild au lieu d'un thème basique.
- **Webuild ne touche jamais directement aux boutiques.** Le serveur fournit le catalogue, la documentation des thèmes, des liens de téléchargement de thèmes verrouillés et des images générées. C'est Claude qui installe, personnalise et publie, avec les accès Shopify de l'utilisateur.
- **Cible** : agences et freelances Shopify.
- **Modèle économique** : abonnement par organisation, avec des crédits consommés selon les actions.
- **Projet distinct** de l'app Webuild publiée sur le Shopify App Store : URL différente, base de données différente, comptes différents. Les thèmes sont communs aux deux produits, mais le code est copié et adapté, sans dépendance entre les projets.
- **Évolution prévue** : un CRM / ERP pour les agences de création de boutiques Shopify.

## 2. Principes

1. **Un seul projet Next.js**, avec le code serveur dedans. Pas de front et de back séparés.
2. **La logique métier est indépendante des canaux.** Le MCP, le dashboard web et une future API publique appellent les mêmes fonctions de `src/modules/`.
3. **Tout appartient à une organisation** (l'agence) : abonnement, crédits, boutiques, livraisons. Chaque table métier porte un `organization_id`, protégé par RLS.
4. **Les outils MCP sont sans état** : chaque appel porte tout son contexte. Aucune "agence active" n'est mémorisée côté serveur.
5. **Une boutique livrée ne dépend jamais du serveur Webuild.** La licence est vérifiée hors ligne, dans le thème.

## 3. Flux de bout en bout

```
Utilisateur : "Crée-moi une boutique de cosmétiques premium"
   |
Claude
   |-- list_my_agencies          (si plusieurs agences : demande laquelle)
   |-- list_themes / get_theme_guide
   |-- Shopify : lit shop.myshopifyDomain
   |-- prepare_theme_install     -> lien signé vers un zip verrouillé sur la boutique
   |-- Shopify : themeCreate(source: lien, role: UNPUBLISHED)
   |-- Shopify : themeFilesUpsert (templates, sections, réglages)
   |-- generate_section_image    -> URL publique de l'image
   |-- Shopify : fileCreate(originalSource: URL)
   |-- Shopify : themeFilesUpsert (référence shopify://shop_images/...)
   |-- l'utilisateur valide l'aperçu
   '-- Shopify : themePublish
```

Points vérifiés dans le schéma GraphQL Admin exposé par le connecteur Shopify : `themeCreate` (depuis une URL de zip, rôles `UNPUBLISHED` ou `DEVELOPMENT`), `themeFilesUpsert`, `themeFilesCopy`, `themeFilesDelete`, `themePublish`, `fileCreate` (depuis une URL externe).

Remarques :
- Le brouillon utilise le rôle `UNPUBLISHED` : les thèmes `DEVELOPMENT` sont temporaires et pensés pour la CLI.
- `themeCreate` et `fileCreate` sont asynchrones : Shopify télécharge le fichier après l'appel. Les liens fournis doivent rester valides assez longtemps (30 minutes au minimum).

## 4. Stack

| Brique | Choix |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| Base de données | Supabase Postgres, **nouveau projet Supabase dédié** |
| Fichiers | Supabase Storage |
| Authentification | Supabase Auth (email + mot de passe, Google) et son serveur OAuth 2.1 pour le MCP. Plan B : Better Auth |
| MCP | `mcp-handler` 2.x sur le SDK officiel `@modelcontextprotocol/server` 2.x, transport Streamable HTTP sans état |
| Paiement | Stripe (Checkout, Customer Portal, webhooks) |
| Cache, quotas, limites de débit | Redis |
| Génération d'images | Gemini (comme l'app existante), derrière une interface pour pouvoir changer de fournisseur |
| Hébergement | À décider (Vercel, Fly.io, Cloudflare, Render, Oracle) |

## 5. Structure du projet

```
src/
  app/
    (site)/               landing, tarifs, documentation publique
    (auth)/               inscription, connexion, mot de passe oublié
    dashboard/[org]/      espace d'une agence (l'agence est dans l'URL)
    oauth/consent/        écran de consentement pour Claude (choix de l'agence par défaut)
    .well-known/          oauth-protected-resource, oauth-authorization-server
    api/
      mcp/                serveur MCP
      stripe/webhook/     synchronisation des abonnements
  modules/
    organizations/        agences, membres, rôles, invitations, places
    billing/              plans, abonnements Stripe, registre de crédits
    themes/               catalogue, versions, guides, build du zip verrouillé
    deliveries/           livraisons (licences)
    images/               génération d'images
    crm/                  clients, boutiques, projets (minimal au début)
    activity/             journal d'activité
  mcp/
    server.ts             création du serveur, instructions envoyées à Claude
    tools/                un fichier par outil, qui appelle modules/
  lib/
    supabase/             clients serveur et navigateur
    redis.ts
    stripe.ts
themes/                   sources des thèmes (pour l'instant : skeleton, thème de test)
skills/
  webuild-store-builder/  méthode Webuild (servie par get_build_guide, téléchargeable comme skill)
supabase/
  migrations/             schéma SQL versionné
```

## 6. Authentification et OAuth pour le MCP

### Web
Supabase Auth : email + mot de passe, connexion Google.

### Claude
Le connecteur est ajouté par l'utilisateur comme "connecteur personnalisé" (Paramètres > Connecteurs), en collant l'URL du MCP. **Aucune autorisation d'Anthropic n'est nécessaire.** Seule l'inscription dans l'annuaire officiel des connecteurs (optionnelle) passe par une revue.

Sur les plans Team et Enterprise, c'est en général un admin de l'organisation Claude qui ajoute le connecteur. Chaque membre s'y connecte ensuite avec son propre compte Webuild.

Exigences de la spec MCP (OAuth 2.1) :
- Serveur public en HTTPS, transport Streamable HTTP.
- Sans jeton valide, le MCP répond `401` avec un en-tête `WWW-Authenticate` qui pointe vers les métadonnées.
- `/.well-known/oauth-protected-resource` (RFC 9728) et `/.well-known/oauth-authorization-server` (RFC 8414).
- PKCE obligatoire (`S256`).
- Dynamic Client Registration (RFC 7591). Support des Client ID Metadata Documents si possible.
- Audience du jeton (RFC 8707) : le jeton est émis pour le MCP Webuild, et le serveur le vérifie. Il n'est jamais transmis à un autre service.
- URLs de retour autorisées : `https://claude.ai/api/mcp/auth_callback` et la variante `claude.com`.
- Refresh tokens activés, sinon l'utilisateur doit reconnecter le connecteur à chaque expiration.

**Premier chantier technique** : valider que le serveur OAuth 2.1 de Supabase Auth fonctionne avec Claude de bout en bout. Si ce n'est pas le cas, basculer sur Better Auth.

## 7. Organisations et utilisateurs multi-agences

- Un utilisateur peut être membre de plusieurs agences, avec un rôle dans chacune : `owner`, `admin` ou `member`.
- Le nombre de places dépend du plan. L'offre gratuite = une agence avec une seule place.

### Sur le dashboard
- Sélecteur d'agence en haut de l'interface.
- L'agence est dans l'URL (`/dashboard/agence-dupont/...`), ce qui permet d'avoir plusieurs onglets sur plusieurs agences.
- La dernière agence utilisée est mémorisée (`user_preferences.last_organization_id`).

### Dans Claude
1. **Agence par défaut** : choisie sur l'écran de consentement OAuth au moment de connecter le connecteur (étape sautée si l'utilisateur n'a qu'une agence). Enregistrée dans `mcp_connections.default_organization_id`.
2. **Paramètre explicite** : les outils payants acceptent un paramètre `agency` optionnel. S'il est absent, on utilise l'agence par défaut. Chaque réponse indique l'agence débitée.
3. **Déduction par la boutique** : une fois un thème livré, la boutique appartient à une agence. Les actions suivantes sur cette boutique sont rattachées à cette agence automatiquement.
4. **La méthode Webuild** (`get_build_guide`) demande à Claude de clarifier l'agence au début d'une nouvelle boutique si l'utilisateur en a plusieurs.

On n'utilise **pas** d'outil `switch_agency` qui changerait un état global : deux conversations Claude ouvertes en parallèle sur deux agences se marcheraient dessus.

### Vérifications à chaque appel
Le jeton prouve l'identité de l'utilisateur. L'appartenance à l'agence est **revérifiée à chaque appel**. Un membre retiré d'une agence perd l'accès immédiatement, même si son connecteur est encore branché.

## 8. Outils MCP

| Outil | Rôle | Crédits |
|---|---|---|
| `list_my_agencies` | Agences de l'utilisateur, rôle, crédits restants | Non |
| `get_account_status` | Plan, crédits, consommation d'une agence | Non |
| `list_themes` | Catalogue : nom, style, niches, aperçus | Non |
| `get_theme_guide` | Sections, schémas des réglages, presets, formats d'image attendus, règles de composition | Non |
| `prepare_theme_install` | Construit le zip verrouillé sur un domaine `myshopify.com`, enregistre la livraison, renvoie un lien signé | Oui |
| `generate_section_image` | Génère une image adaptée à une section (ratio, style du thème), renvoie une URL publique, un nom de fichier et un texte alternatif | Oui |

Le serveur MCP envoie aussi des **instructions** à Claude à la connexion (rappel du déroulé et des règles importantes).

Le guide des thèmes est construit à partir des fichiers `*-tools.json` de l'app existante, qui décrivent déjà chaque section avec un schéma JSON.

### Méthode "Webuild Store Builder"
Fournie directement par le connecteur, sans rien à installer : les instructions du serveur demandent à Claude d'appeler `get_build_guide`, qui renvoie la méthode (source unique : `skills/webuild-store-builder/SKILL.md`). Le prompt MCP `construire-boutique` la charge aussi en un clic. Le même fichier reste téléchargeable comme skill pour Claude Code. Elle décrit :
- le déroulé complet de la section 3,
- la clarification de l'agence au départ,
- l'usage du rôle `UNPUBLISHED` et la validation par l'utilisateur avant `themePublish`,
- l'import des images avec `fileCreate` et leur référence `shopify://shop_images/<fichier>`,
- les bonnes pratiques de composition propres à chaque thème.

## 9. Abonnement et crédits

- L'abonnement appartient à l'organisation. Chaque plan définit des crédits mensuels et un nombre de places.
- Exemples de coûts, **à calibrer** : génération de thème = 200 crédits, image = 50 crédits.
- **Registre de transactions** (`credit_transactions`) plutôt qu'un compteur : recharge mensuelle, débits, remboursements. Le solde est la somme des transactions.
- **Prix configurables en base** (`credit_prices`), modifiables sans redéploiement.
- **Coût réel enregistré** pour chaque opération (coût du fournisseur d'images, etc.), pour mesurer les marges.
- **Idempotence** : Claude peut relancer un outil. Chaque opération payante porte une clé d'idempotence. `prepare_theme_install` pour le même thème, la même version et la même boutique renvoie la livraison existante sans débiter à nouveau.
- **Débit seulement en cas de succès** : une image qui échoue ne coûte rien.
- **Re-téléchargement gratuit** d'une livraison existante (même boutique, même version).
- L'abonnement est vérifié à **chaque appel d'outil** (statut synchronisé par les webhooks Stripe), pas seulement à la connexion.
- Plus tard : packs de crédits en complément de l'abonnement.

## 10. Licences et verrouillage

- Une livraison est **à vie** et **figée** : la boutique garde la version livrée, sans mise à jour.
- La licence est liée au **domaine permanent `xxx.myshopify.com`**, pas au domaine personnalisé (qui peut changer, être ajouté ou absent).
- **Vérification hors ligne, dans le thème**, pour que la boutique ne dépende jamais du serveur Webuild :
  - en Liquid, à partir de `shop.permanent_domain` (rendu côté serveur par Shopify) ;
  - dans le JavaScript obfusqué, à partir de `Shopify.shop`.
- Le zip contient une **empreinte** du domaine (hachage avec un sel propre à la livraison) plutôt que le domaine en clair.
- **Si le thème tourne sur une autre boutique** :
  - les visiteurs voient un écran bloquant "Thème non licencié pour cette boutique" ;
  - dans l'éditeur de thème (`request.design_mode`), le marchand voit un message avec un lien pour obtenir une licence Webuild.
- Cette protection est dissuasive, pas absolue. La vraie valeur pour l'agence reste l'abonnement (catalogue, MCP, images, nouveaux thèmes).

## 11. Thèmes

- **Catalogue dans le code** (`src/modules/themes/catalog.ts`) et **sources dans le dépôt** (`themes/<slug>/`, dossiers Shopify standards uniquement). Le dépôt est privé ; les sources sont embarquées dans les fonctions serveur.
- Chaque thème a un **guide** (`themes/<slug>/guide.json`), généré depuis les schémas Liquid par `npm run themes:guides` et exposé par `get_theme_guide`.
- **Livraison** : `create_delivery` enregistre la boutique, la licence (sel aléatoire + empreinte `sha256(domaine:sel)`) et débite les crédits la première fois.
- **Zip construit à la volée** par `/api/themes/download/<thème>.zip?token=<jeton>` (jeton en paramètre : `themeCreate` refuse un chemin qui le contient) : le jeton (signé HMAC, `THEME_DOWNLOAD_SECRET`, valable 1 h) contient tout ce qu'il faut (thème, domaine, sel, empreinte). Aucun stockage de zip, aucun accès base pour Shopify. Un nouveau lien est gratuit pour une livraison existante.
- **Thème de test** : le Skeleton theme de Shopify (v1.0.0), en attendant les vrais thèmes premium.

## 12. Images

- Génération à la demande de Claude, pour une section précise : le format est choisi par Claude, ou déduit de la section et du réglage (hero et bannières en 16:9, mobile en 9:16, sinon 4:5).
- Fournisseur : Gemini (`GEMINI_API_KEY`, modèle `GEMINI_IMAGE_MODEL`). Coût estimé enregistré pour chaque image.
- Débit avant la génération, **remboursement automatique** en cas d'échec. Le remboursement est fait par le serveur (clé secrète) : un membre ne peut pas rembourser un débit lui-même.
- Stockage dans le bucket public `generated-images`, dossier = identifiant de l'agence, écrit avec le jeton de l'utilisateur (politique RLS de Storage). Les images servent de relais : Claude les importe dans la boutique avec `fileCreate`. Elles pourront être purgées après un délai.
- Recommandation dans la méthode : images d'ambiance (hero, bannières, lifestyle). Ne pas remplacer les vraies photos de produits.

## 13. Modèle de données

Toutes les tables métier portent `organization_id` et sont protégées par RLS.

```
profiles             user_id (auth.users), full_name, avatar_url
organizations        id, name, slug, created_at
memberships          organization_id, user_id, role, created_at
invitations          organization_id, email, role, token, expires_at, accepted_at
user_preferences     user_id, last_organization_id
mcp_connections      user_id, oauth_client_id, default_organization_id, created_at

plans                id, name, monthly_credits, max_members, stripe_price_id
subscriptions        organization_id, plan_id, stripe_customer_id,
                     stripe_subscription_id, status, current_period_end
credit_prices        action, credits, active
credit_transactions  id, organization_id, user_id, amount, reason,
                     reference_type, reference_id, idempotency_key (unique),
                     provider_cost_cents, created_at

themes               id, slug, name, description, niches, preview_url, is_active
theme_versions       id, theme_id, version, source_path, guide (jsonb), is_current

clients              id, organization_id, name, email, ...          (CRM)
shops                id, organization_id, client_id, myshopify_domain
projects             id, organization_id, shop_id, name, status      (CRM)
deliveries           id, organization_id, shop_id, theme_version_id,
                     myshopify_domain, artifact_path, license_fingerprint,
                     created_by, credit_transaction_id, created_at
                     unique (shop_id, theme_version_id)
image_generations    id, organization_id, shop_id, user_id, theme_id, section,
                     prompt, aspect_ratio, storage_path, public_url, status,
                     model, provider_cost_cents, credit_transaction_id, created_at

activity_log         id, organization_id, actor_user_id, action,
                     entity_type, entity_id, metadata, created_at
```

Notes :
- `shops.myshopify_domain` est unique **par organisation**, pas globalement : une boutique peut changer d'agence, et la nouvelle agence peut livrer un nouveau thème.
- `activity_log` alimentera la future timeline client du CRM.

## 14. Sécurité

- RLS sur toutes les tables métier, filtrée par les appartenances de l'utilisateur.
- Les opérations sensibles (débit de crédits, livraisons) passent par des fonctions serveur, jamais directement depuis le navigateur.
- Bucket des sources et des zips privé, accessible uniquement par liens signés à durée courte.
- Limites de débit par utilisateur et par organisation (Redis).
- Vérification de la signature des webhooks Stripe.
- Aucun secret dans le dépôt : variables d'environnement uniquement.

## 15. Évolution vers un CRM / ERP

Ce qui est posé dès maintenant pour que le CRM arrive sans migration douloureuse :
- multi-organisation partout ;
- entités `clients`, `shops`, `projects`, déjà reliées aux livraisons ;
- journal d'activité ;
- logique métier dans `modules/`, réutilisable par le dashboard, le MCP et une future API.

Plus tard, Claude pourra aussi utiliser des outils CRM (créer un client, ajouter une note, suivre un projet).

## 16. Points ouverts

- Compatibilité du serveur OAuth 2.1 de Supabase Auth avec Claude (premier chantier).
- La version 2026-07-28 de la spec MCP remplace le Dynamic Client Registration par les Client ID Metadata Documents (CIMD). Supabase gère le DCR ; vérifier son support des CIMD et ce que Claude utilise.
- Audience des jetons (RFC 8707) : les jetons Supabase ont `aud = authenticated`, pas l'URL du MCP. Le MCP exige pour l'instant un `client_id` (jeton OAuth uniquement). Un Custom Access Token Hook pourra ajouter une audience dédiée.
- Limites des connecteurs personnalisés sur le plan gratuit de Claude.
- **Licence des thèmes** : le Skeleton theme (et tout thème qui en dérive) est sous licence Shopify, qui mentionne la vente via le Shopify Theme Store. À faire vérifier par un juriste avant de vendre un thème dérivé.
- Calibrage des prix en crédits, à partir des coûts réels mesurés.
- Choix de l'hébergeur (durée maximale des fonctions pour la génération d'images, Redis managé ou non).
- Contenu exact des plans (crédits, places, prix).

## 17. Étapes

1. ~~Validation OAuth~~ : fait.
2. ~~Socle~~ : comptes, agences, membres, invitations, dashboard.
3. ~~Thèmes~~ : catalogue, guides, zip verrouillé, livraisons, outils MCP.
4. ~~Images~~ : génération par section.
5. ~~Paiement~~ : Stripe, plans, registre de crédits, limite de places.
6. ~~Méthode et onboarding~~ : méthode "Webuild Store Builder" fournie par le MCP, page "Connecter Claude".
7. **CRM** : clients, projets, timeline.
8. **À suivre** : envoi des emails (SMTP), captures d'écran des thèmes, calibrage des prix, invitations par email, purge des images, packs de crédits.
