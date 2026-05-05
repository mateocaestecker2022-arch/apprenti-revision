# CLAUDE.md — Apprenti Révision

Lis ce fichier en entier avant toute modification.

---

## Projet

Site d'aide aux révisions : upload d'un cours → structuration IA → quiz / flashcards / fiches.
Stack fullstack Next.js 14, pas de backend séparé. Worker BullMQ séparé pour le traitement IA.

---

## Stack

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 14 App Router + TypeScript |
| DB | PostgreSQL via Prisma ORM |
| Auth | NextAuth v5 beta (`next-auth@5.0.0-beta`) |
| Queue | BullMQ + Redis |
| IA | Groq SDK (llama-3.3-70b-versatile) |
| Upload | mammoth (docx), pdf-parse, jszip |
| UI | Tailwind CSS + Tiptap (éditeur) |
| State | Zustand + React Query |

---

## Structure

```
src/
  app/
    (auth)/         login / register — route group sans layout dashboard
    api/            routes API Next.js
    courses/[id]/   page cours individuel
    dashboard/      page principale
    folders/        gestion dossiers
    upload/         upload cours
  components/
    accounts/
    dashboard/
    layout/
  lib/
    anthropic.ts    client Anthropic (si utilisé)
    auth.ts         config NextAuth v5
    prisma.ts       instance PrismaClient singleton
    queue.ts        BullMQ queue producer
    redis.ts        client Redis

worker.ts           FICHIER SÉPARÉ — tourne en process indépendant
prisma/
  schema.prisma     modèles DB
```

---

## Modèles de données (Prisma)

```
User → Folder[] → Course[]
Course → Quiz[] → QuizResult[]
Course → Flashcard[]
Course → Score[]

Course.status : "processing" | "ready" | "error"
Course.structuredContent : JSON (structuré par le worker)
Course.keywords : JSON
```

---

## Règles obligatoires

### Auth — NextAuth v5 (IMPORTANT — différent de v4)
- **NE PAS** utiliser `getServerSession(authOptions)` — c'est la v4
- **Utiliser** `auth()` depuis `@/lib/auth` dans les Server Components
- **Utiliser** `useSession()` côté client
- Les routes protégées sont dans `middleware.ts`

### Prisma
- Toujours utiliser le singleton `prisma` depuis `@/lib/prisma` — jamais `new PrismaClient()`
- Après modification du schema : `npm run db:push` (dev) ou `npm run db:migrate` (prod)
- `npm run db:generate` après chaque changement de schema

### Worker (worker.ts)
- Tourne en process séparé : `npm run worker:start`
- **Concurrency = 1** — ne pas augmenter sans tests
- Le worker fait toujours `prisma.course.update` (jamais create) — le course existe déjà en DB avec status "processing"
- Ordre des appels Groq : structuration → enrichissement (sleep 5s) → recherche (sleep 5s)
- Cache Redis : `redis.setex(cacheKey, 86400, JSON.stringify(result))` — TTL 24h
- **Articles whitelist** : INTERDIT d'ajouter des articles hors de `ARTICLES_WHITELIST` — filtre appliqué sur la réponse Groq
- Rate limit Groq 429 : attente 15s puis retry (déjà géré dans `callGroq`)

### Queue (BullMQ)
- Producer dans `lib/queue.ts` — ajouter un job : `queue.add('course-processing', { courseId, content })`
- Le job est créé APRÈS avoir sauvegardé le course en DB avec status "processing"
- Ne jamais appeler le worker directement depuis les routes API

### Parsing JSON Groq
- Toujours extraire avec `/\{[\s\S]*\}/` — le modèle peut wrapper dans du texte
- Valider avant d'utiliser — les chunks peuvent produire du JSON invalide (géré avec try/catch)

### Frontend
- App Router — tout dans `app/`, pas de `pages/`
- Les Server Components fetchent directement via Prisma (pas de fetch API interne)
- Les Client Components (`"use client"`) utilisent React Query / Zustand
- Dark mode géré globalement — ne pas hardcoder des couleurs light

---

## Erreurs à ne pas répéter

- **NextAuth v5** : `auth()` pas `getServerSession()` — erreur classique qui casse l'auth silencieusement
- **PrismaClient** : instancier `new PrismaClient()` dans une route API → connexions qui explosent en prod — toujours le singleton de `lib/prisma.ts`
- **Worker status** : oublier de passer le status à `"error"` quand le traitement échoue → course bloqué en "processing" pour toujours
- **Articles hors whitelist** : ne jamais laisser Groq inventer des articles de loi — le filtre `filterArticles()` doit toujours être appliqué
- **BullMQ job sans course en DB** : créer le job avant la DB → le worker crashe car il ne trouve pas le courseId
- **Chunks JSON** : `parsed.sections` peut être undefined si le chunk est trop court → toujours `|| []`
- **Redis connection** : ne pas créer plusieurs instances — utiliser `lib/redis.ts`
- **Groq `response_format: json_object`** : le modèle retourne quand même parfois du texte avant le JSON → toujours matcher avec la regex

---

## Commandes utiles

```bash
# Dev
npm run dev               # Next.js dev server
npm run worker:start      # Worker BullMQ (process séparé)

# DB
npm run db:push           # Apply schema changes (dev)
npm run db:migrate        # Run migrations (prod)
npm run db:generate       # Regenerate Prisma client
npm run db:studio         # Prisma Studio UI

# Build
npm run build
npm run lint
```

---

## Variables d'environnement nécessaires

```
DATABASE_URL
NEXTAUTH_SECRET
GROQ_API_KEY
REDIS_URL
GOOGLE_CLIENT_ID       (si OAuth Google)
GOOGLE_CLIENT_SECRET
```

---

## État actuel

- Auth (email + password) ✅
- Upload cours (PDF, DOCX) ✅
- Structuration IA via Groq (worker BullMQ) ✅
- Enrichissement pédagogique (logique, erreurs fréquentes, problèmes juridiques) ✅
- Carte mentale (schema) ✅
- Jurisprudence + distinctions clés ✅
- Whitelist articles de loi ✅
- Dossiers (Folder) ✅
- Quiz / Flashcards / Scores ✅
- Cache Redis 24h ✅
