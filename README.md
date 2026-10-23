# Webuild pour Claude

Catalogue de thèmes Shopify premium, pilotable par Claude via un serveur MCP. Voir [ARCHITECTURE.md](./ARCHITECTURE.md) pour les décisions d'architecture.

Projet Next.js 16 (App Router), Supabase (Postgres, Auth, Storage).

## État actuel : validation OAuth

Cette première version sert à valider que Claude peut se connecter au MCP Webuild via le serveur OAuth 2.1 de Supabase Auth :

| Route | Rôle |
|---|---|
| `/login` | Connexion et inscription (email + mot de passe, Google) |
| `/auth/callback` | Retour de Google et des liens de confirmation email |
| `/oauth/consent` | Écran de consentement OAuth (Supabase y redirige avec un `authorization_id`) |
| `/.well-known/oauth-protected-resource/api/mcp` | Métadonnées RFC 9728 : Supabase Auth est le serveur d'autorisation |
| `/.well-known/oauth-authorization-server` | Copie des métadonnées Supabase pour les anciens clients MCP |
| `/api/mcp` | Serveur MCP (Streamable HTTP), protégé par jeton Bearer. Un seul outil : `whoami` |

## Développement local

```bash
cp .env.example .env.local   # puis renseigner la clé publishable
npm install
npm run dev
```

Scripts utiles : `npm run typecheck`, `npm run lint`, `npm run build`.

## Configuration Supabase

1. **Settings > API Keys** : copier la clé **publishable** (`sb_publishable_...`) dans `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. **Authentication > OAuth Server** :
   - activer le serveur OAuth ;
   - activer l'enregistrement dynamique des clients ;
   - Authorization Path : `/oauth/consent`.
3. **Authentication > URL Configuration** :
   - Site URL : l'URL publique du site (par exemple `https://webuild-xxx.vercel.app`). L'écran de consentement est à `Site URL + Authorization Path` ;
   - Redirect URLs : ajouter `https://<domaine>/auth/callback` et `http://localhost:3000/auth/callback`.
4. **Authentication > Sign In / Providers > Google** : activer Google avec un client OAuth créé dans Google Cloud. Dans Google Cloud, l'URL de redirection autorisée est `https://spuacvknjmbhirfxfptt.supabase.co/auth/v1/callback`.

## Connecter Claude

Le MCP doit être joignable en HTTPS (Claude ne peut pas se connecter à `localhost`).

1. Déployer le projet (par exemple sur Vercel) avec les variables de `.env.example`.
2. Dans Claude : Paramètres > Connecteurs > Ajouter un connecteur personnalisé, avec l'URL `https://<domaine>/api/mcp`.
3. Se connecter à Webuild et autoriser l'accès sur l'écran de consentement.
4. Demander à Claude d'appeler l'outil `whoami` : il doit renvoyer l'email du compte connecté.
