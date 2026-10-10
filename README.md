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

Les variables sont validées avec Zod dans `src/config/`.

### Base de données

```bash
npm run db:generate   # génère une migration depuis src/db/schema.ts
npm run db:migrate    # applique les migrations (DATABASE_DIRECT_URL)
npm run db:studio     # explorer la base
```

Toutes les tables ont la RLS activée sans policy : seule l'app (via Drizzle, côté serveur) y accède, la clé publique Supabase ne peut ni lire ni écrire.

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
