# Webuild pour Claude

Catalogue de thèmes Shopify premium, pilotable par Claude via un serveur MCP. Voir [ARCHITECTURE.md](./ARCHITECTURE.md) pour les décisions d'architecture.

Projet Next.js 16 (App Router), Supabase (Postgres, Auth, Storage), Stripe, Gemini.

## Fonctionnalités

**Site et dashboard**

| Route | Rôle |
|---|---|
| `/` | Présentation et thèmes |
| `/login`, `/forgot-password`, `/reset-password` | Connexion, inscription (email + mot de passe, Google), mot de passe oublié |
| `/dashboard/[agence]` | Vue d'ensemble : crédits, plan, boutiques, membres |
| `/dashboard/[agence]/claude` | Connecter Claude (URL du MCP, exemples) |
| `/dashboard/[agence]/themes` | Catalogue et détail des thèmes |
| `/dashboard/[agence]/shops` | Boutiques livrées, re-téléchargement du zip |
| `/dashboard/[agence]/images` | Images générées |
| `/dashboard/[agence]/credits` | Solde, tarifs, historique |
| `/dashboard/[agence]/billing` | Plans, paiement Stripe, portail client |
| `/dashboard/[agence]/members` | Membres, invitations, places |
| `/oauth/consent` | Consentement OAuth de Claude, avec choix de l'agence par défaut |

**Serveur MCP** (`/api/mcp`, OAuth Supabase)

| Outil | Rôle | Crédits |
|---|---|---|
| `list_my_agencies` | Agences, rôle, solde, agence par défaut | Non |
| `get_account_status` | Plan, solde, tarifs | Non |
| `get_build_guide` | Méthode complète de construction d'une boutique (contenu de `skills/webuild-store-builder/SKILL.md`) | Non |
| `list_themes` | Catalogue | Non |
| `get_theme_guide` | Templates, sections, réglages, emplacements d'image | Non |
| `prepare_theme_install` | Licence + lien de zip verrouillé sur la boutique | Oui (une fois par boutique et version) |
| `generate_section_image` | Image Gemini pour une section, URL publique | Oui (remboursé en cas d'échec) |

Le serveur fournit aussi le prompt `construire-boutique` (menu + de Claude) et des instructions qui renvoient vers `get_build_guide` : l'utilisateur n'a pas de skill à installer.

**Autres routes** : `/api/themes/download/[thème].zip?token=...` (zip signé, valable 1 h), `/api/skill/download` (la même méthode en skill, pour Claude Code), `/api/stripe/webhook`.

## Thèmes

Les sources sont dans `themes/<slug>/` (dossiers Shopify standards uniquement). Le zip livré est construit à la volée : ajout de `snippets/webuild-license.liquid` et de ses appels dans `layout/`. Le verrou compare `shop.permanent_domain` (Liquid) et `Shopify.shop` (JS) à l'empreinte de la livraison ; sur une autre boutique, la vitrine affiche "Thème non licencié".

Après une modification des sections d'un thème, régénérer son guide :

```bash
npm run themes:guides
```

Pour ajouter un thème : copier ses dossiers dans `themes/<slug>/`, l'ajouter à `src/modules/themes/catalog.ts`, puis régénérer les guides.

## Base de données

Les migrations sont dans `supabase/migrations/`, à exécuter dans l'ordre dans le **SQL Editor** de Supabase.

Les tests de sécurité (RLS, crédits, livraisons, places) tournent sur un Postgres local jetable qui imite Supabase :

```bash
PSQL="sudo -u postgres psql" npm run test:db
```

Chaque ligne `===` du résultat annonce ce qui est attendu (un refus attendu apparaît comme `ERROR`).

## Variables d'environnement

Voir `.env.example`. Dans Vercel, les clés secrètes sont de type **Secret** et ne commencent jamais par `NEXT_PUBLIC_`.

| Variable | Obligatoire | Usage |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Oui | Supabase |
| `THEME_DOWNLOAD_SECRET` | Oui | Signature des liens de zip (32 caractères aléatoires minimum) |
| `SUPABASE_SECRET_KEY` | Pour Stripe et les images | Webhook Stripe (abonnements et crédits), remboursement des images ratées |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Pour le paiement | Abonnements |
| `GEMINI_API_KEY` | Pour les images | Génération d'images (avec `SUPABASE_SECRET_KEY`) |

## Configuration externe

**Supabase**
- Authentication > OAuth Server : activé, enregistrement dynamique activé, Authorization Path `/oauth/consent`.
- Authentication > URL Configuration : Site URL `https://webuild-claude.vercel.app` (sans slash final), Redirect URLs `https://webuild-claude.vercel.app/auth/callback`.
- Authentication > Emails > SMTP Settings : un vrai service d'envoi (Resend, Postmark...) pour la confirmation d'email et le mot de passe oublié. Le service intégré de Supabase est très limité.

**Stripe**
- Developers > Webhooks : endpoint `https://webuild-claude.vercel.app/api/stripe/webhook`, événements `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`.
- Settings > Billing > Customer portal : activer le portail (factures, moyen de paiement, changement de plan, résiliation).
- Les produits et prix sont créés automatiquement au premier paiement, à partir de la table `plans`.

## Développement local

```bash
cp .env.example .env.local   # puis renseigner les valeurs
npm install
npm run dev
```

Scripts : `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:db`, `npm run themes:guides`.
