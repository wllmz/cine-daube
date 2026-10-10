# Ciné Daube

Les pires comédies françaises, notées entre potes. Une roulette live tire une comédie française dispo sur Netflix, Prime Video, Disney+ ou Canal+, la room vote, regarde, puis note l'humour et le scénario.

## Stack

- Next.js 16 (App Router), TypeScript strict, Tailwind CSS 4
- Supabase : Postgres, Auth (email + mot de passe), Realtime (presence + broadcast)
- Drizzle ORM pour les requêtes serveur et les migrations
- Zod, React Query, React Hook Form, Zustand
- Vitest + Testing Library
- Catalogue de films : API TMDB

## Démarrer

```bash
npm install
npm run dev
```

### Variables d'environnement

À mettre dans `.env.local` (jamais commité) :

| Variable | Où la trouver | Usage |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase › Project Settings › API | Client Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase › Project Settings › API Keys | Client Supabase |
| `DATABASE_URL` | Supabase › Connect › Transaction pooler (port 6543) | Requêtes Drizzle au runtime |
| `DATABASE_DIRECT_URL` | Supabase › Connect › Session pooler (port 5432) | Migrations `drizzle-kit` |
| `SITE_URL` | URL publique de l'app (`http://localhost:3000` en dev) | Liens envoyés par email |

### Auth Supabase

- Authentication › URL Configuration : **Site URL** = `SITE_URL`, et **Redirect URLs** contient `<SITE_URL>/auth/callback**`.
- Les emails utilisent les templates par défaut (flux PKCE) : le lien doit être ouvert dans le navigateur qui a fait la demande. Les templates ne sont modifiables qu'avec un SMTP personnalisé, qui est aussi nécessaire pour envoyer des emails à d'autres adresses que celles de l'organisation Supabase.

Les variables de l'app sont validées avec Zod dans `src/config/`, `DATABASE_DIRECT_URL` dans `drizzle.config.ts`.

### Base de données

```bash
npm run db:generate   # génère une migration depuis src/db/schema.ts
npm run db:migrate    # applique les migrations (DATABASE_DIRECT_URL)
npm run db:studio     # explorer la base
```

Toutes les tables ont la RLS activée sans policy : seule l'app (via Drizzle, côté serveur) y accède, la clé publique Supabase ne peut ni lire ni écrire.

Les règles métier critiques sont garanties par la base (clés étrangères composites et checks) : un seul vote en cours par room, seuls les membres votent et notent, notes entre 0 et 10, impossible de noter un film « déjà vu », supprimer un compte ne détruit pas l'historique de la room. Elles sont couvertes par `tests/integration/schema.test.ts`, qui applique les migrations sur un Postgres en mémoire (PGlite).

## Scripts

| Script | Rôle |
| --- | --- |
| `npm run dev` | Serveur de dev |
| `npm run build` | Build de production |
| `npm run lint` | ESLint |
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Tests Vitest |

## Structure

```
src/
├── app/           # Routing uniquement
├── features/      # Code métier par domaine (auth, rooms, catalog, roulette, ratings, realtime)
├── components/ui/ # Primitives partagées (Button, Tomy…)
├── db/            # Schéma Drizzle + client
├── config/        # Validation des variables d'env
└── lib/           # Helpers partagés (Supabase, format, utils)
```
