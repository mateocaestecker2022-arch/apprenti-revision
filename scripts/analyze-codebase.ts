/**
 * AGENT IA — ANALYSE DU CODEBASE
 *
 * Explore automatiquement tous les fichiers du projet,
 * détecte les bugs, violations de règles et incohérences,
 * et génère un rapport structuré.
 *
 * Usage : npm run analyze
 */

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const PROJECT_ROOT = path.join(__dirname, '..')

// ============================================================
// IMPLÉMENTATION DES TOOLS
// ============================================================

function readFile(filePath: string): string {
  const fullPath = path.join(PROJECT_ROOT, filePath)
  if (!fs.existsSync(fullPath)) return `ERREUR: Fichier introuvable: ${filePath}`
  try {
    return fs.readFileSync(fullPath, 'utf-8')
  } catch (e) {
    return `ERREUR lecture: ${e}`
  }
}

function listFiles(directory: string = 'src', extension?: string): string {
  const fullPath = path.join(PROJECT_ROOT, directory)
  if (!fs.existsSync(fullPath)) return `ERREUR: Répertoire introuvable: ${directory}`

  const results: string[] = []

  function walk(dir: string, prefix: string = '') {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          walk(path.join(dir, entry.name), relativePath)
        } else if (!extension || entry.name.endsWith(extension)) {
          results.push(`${directory}/${relativePath}`)
        }
      }
    } catch {}
  }

  walk(fullPath)

  if (directory === 'src') {
    for (const f of ['worker.ts', 'prisma/schema.prisma', 'next.config.js', 'package.json']) {
      if (fs.existsSync(path.join(PROJECT_ROOT, f))) results.push(f)
    }
  }

  return results.length > 0 ? results.join('\n') : 'Aucun fichier trouvé'
}

function searchInCode(searchPattern: string, directory: string = 'src'): string {
  const results: string[] = []

  function searchFile(filePath: string, relPath: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      lines.forEach((line, idx) => {
        if (line.includes(searchPattern)) {
          results.push(`${relPath}:${idx + 1}    ${line.trim()}`)
        }
      })
    } catch {}
  }

  function walk(dir: string, prefix: string = '') {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          walk(path.join(dir, entry.name), relativePath)
        } else if (entry.name.match(/\.(ts|tsx|js|jsx)$/)) {
          searchFile(path.join(dir, entry.name), `${directory}/${relativePath}`)
        }
      }
    } catch {}
  }

  const fullPath = path.join(PROJECT_ROOT, directory)
  if (fs.existsSync(fullPath)) walk(fullPath)

  for (const extra of ['worker.ts', 'scripts']) {
    const ep = path.join(PROJECT_ROOT, extra)
    if (fs.existsSync(ep)) {
      const stat = fs.statSync(ep)
      if (stat.isFile()) searchFile(ep, extra)
      else walk(ep, extra)
    }
  }

  if (results.length === 0) return `Aucune occurrence de "${searchPattern}" trouvée`
  return results.join('\n')
}

function getFileStats(): string {
  const stats = { routes_api: 0, pages: 0, components: 0, lib: 0, total_ts_files: 0 }

  function walk(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue
        if (entry.isDirectory()) walk(path.join(dir, entry.name))
        else if (entry.name.match(/\.(ts|tsx)$/)) {
          stats.total_ts_files++
          const p = path.join(dir, entry.name)
          if (p.includes('/api/')) stats.routes_api++
          else if (p.includes('/components/')) stats.components++
          else if (p.includes('/lib/')) stats.lib++
          else if (entry.name === 'page.tsx') stats.pages++
        }
      }
    } catch {}
  }

  walk(path.join(PROJECT_ROOT, 'src'))
  return JSON.stringify(stats, null, 2)
}

// ============================================================
// DÉFINITION DES TOOLS (format Anthropic)
// ============================================================

const tools: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Lire le contenu complet d\'un fichier du projet',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description:
            'Chemin relatif depuis la racine du projet. Exemples: ' +
            'src/app/api/courses/route.ts, worker.ts, prisma/schema.prisma, ' +
            'src/lib/auth.ts, src/components/ThemeToggle.tsx',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_files',
    description: 'Lister récursivement tous les fichiers d\'un répertoire',
    input_schema: {
      type: 'object' as const,
      properties: {
        directory: {
          type: 'string',
          description: 'Répertoire à lister (ex: src, src/app/api, src/lib, scripts). Défaut: src',
        },
        extension: {
          type: 'string',
          description: 'Filtrer par extension (ex: .ts, .tsx). Optionnel.',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_in_code',
    description:
      'Chercher une chaîne de texte dans tous les fichiers TS/TSX du projet. ' +
      'Retourne chaque ligne correspondante avec son numéro.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description:
            'Texte exact à chercher. Exemples: "getServerSession", "new PrismaClient", ' +
            '"new Redis(", "filterArticles", "catch"',
        },
        directory: {
          type: 'string',
          description: 'Répertoire de recherche. Défaut: src',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'get_file_stats',
    description: 'Obtenir les statistiques globales du projet (nombre de fichiers par catégorie)',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
]

// ============================================================
// EXÉCUTEUR DE TOOLS
// ============================================================

function executeTool(name: string, input: Record<string, string>): string {
  switch (name) {
    case 'read_file':
      return readFile(input.path)
    case 'list_files':
      return listFiles(input.directory, input.extension)
    case 'search_in_code':
      return searchInCode(input.pattern, input.directory || 'src')
    case 'get_file_stats':
      return getFileStats()
    default:
      return `Tool inconnu: ${name}`
  }
}

// ============================================================
// SYSTEM PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es un expert senior en audit de code TypeScript/Next.js.
Tu analyses le projet "Apprenti Révision" — une app Next.js 14 App Router avec NextAuth v5, Prisma (PostgreSQL), BullMQ, Redis et Groq API.

======= RÈGLES STRICTES DU PROJET À VÉRIFIER =======

R1 — NextAuth v5 :
  ✓ Utiliser \`auth()\` depuis \`@/lib/auth\` dans les Server Components et routes API
  ✗ JAMAIS \`getServerSession(authOptions)\` (c'est NextAuth v4)

R2 — Prisma singleton :
  ✓ Toujours importer \`prisma\` depuis \`@/lib/prisma\`
  ✗ JAMAIS \`new PrismaClient()\` dans une route API ou composant (sauf worker.ts qui est un process séparé)

R3 — Redis singleton :
  ✓ Toujours importer \`redis\` depuis \`@/lib/redis\` dans les routes API
  ✗ JAMAIS \`new Redis()\` dans les routes (sauf worker.ts)

R4 — Auth dans les routes API :
  ✓ Chaque route API doit vérifier la session en tout début et retourner 401 si non connecté
  ✗ Jamais servir de données sans vérification d'auth

R5 — Try/catch dans les routes API :
  ✓ Chaque route doit avoir un try/catch global qui retourne 500
  ✗ Aucune route sans gestion d'erreur

R6 — Worker BullMQ — status "error" :
  ✓ Le catch du worker doit TOUJOURS faire \`prisma.course.update({ data: { status: 'error' } })\`
  ✗ Un cours bloqué en "processing" pour toujours = bug critique

R7 — Ordre BullMQ :
  ✓ Créer le course en DB (status "processing") PUIS enqueue le job BullMQ
  ✗ Jamais enqueue avant que le course existe en DB

R8 — Parsing JSON Groq :
  ✓ Toujours extraire avec regex \`/\\{[\\s\\S]*\\}/\`
  ✓ Toujours try/catch autour de JSON.parse
  ✓ Toujours \`|| []\` sur les arrays parsés

R9 — Articles de loi (cours Droit) :
  ✓ \`filterArticles()\` doit être appliqué sur TOUTES les réponses Groq qui contiennent des articles

R10 — Imports non résolus :
  ✓ Vérifier que chaque import depuis @/ correspond à un fichier qui existe réellement

======= BUGS GÉNÉRIQUES À DÉTECTER =======

- \`await\` oublié devant une Promise (appel Prisma, Groq, Redis sans await)
- Accès à .property sur une valeur potentiellement null/undefined sans guard
- Mutations de données sans vérifier que la ressource appartient à l'user connecté (IDOR)
- Secrets ou clés API en dur dans le code source
- Types \`any\` excessifs ou cast forcés dangereux
- Composants "use client" qui importent des modules serveur-only

======= PROCESSUS =======

1. list_files() — vue globale
2. Lis chaque fichier de src/app/api/ (toutes les routes)
3. Lis worker.ts, src/lib/auth.ts, src/lib/prisma.ts, src/lib/redis.ts, src/lib/queue.ts
4. Lis les pages et composants
5. search_in_code() pour confirmer les patterns globaux
6. Génère le rapport final COMPLET

======= FORMAT DU RAPPORT FINAL =======

## RAPPORT D'ANALYSE — APPRENTI RÉVISION

### Résumé
- X fichiers analysés, X bugs critiques / X majeurs / X mineurs

---
### [CRITIQUE] Titre
**Fichier :** chemin:ligne
**Problème :** ...
**Suggestion :** ...

### [MAJEUR] Titre
...

### [MINEUR] Titre
...

---
### Conclusion
Santé globale du code et priorités.`

// ============================================================
// AGENT PRINCIPAL
// ============================================================

async function runAgent(): Promise<void> {
  const startTime = Date.now()
  console.log('\n' + '═'.repeat(60))
  console.log('  🔍  AGENT IA — ANALYSE DU CODEBASE')
  console.log('  Projet : Apprenti Révision')
  console.log('  Modèle : claude-sonnet-4-6 (Anthropic)')
  console.log('═'.repeat(60))

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content:
        'Lance une analyse complète et exhaustive du codebase. ' +
        'Commence par lister tous les fichiers, lis-les un par un (surtout les routes API et le worker), ' +
        'puis génère le rapport final structuré avec TOUS les bugs trouvés.',
    },
  ]

  let iteration = 0
  const MAX_ITERATIONS = 60

  while (iteration < MAX_ITERATIONS) {
    iteration++

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    })

    console.log(`\n[${iteration}] stop_reason: ${response.stop_reason}`)

    // Ajouter la réponse de l'assistant à l'historique
    messages.push({ role: 'assistant', content: response.content })

    // L'agent a terminé
    if (response.stop_reason === 'end_turn') {
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      console.log('\n' + '═'.repeat(60))
      console.log(`  ✅  Analyse terminée en ${elapsed}s (${iteration} itérations)`)
      console.log('═'.repeat(60) + '\n')

      let reportText = ''
      for (const block of response.content) {
        if (block.type === 'text') {
          console.log(block.text)
          reportText += block.text
        }
      }

      // Sauvegarde dans un fichier .md horodaté
      const date = new Date()
      const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const outputPath = path.join(PROJECT_ROOT, 'scripts', `rapport-analyse-${timestamp}.md`)
      const header = `# Rapport d'analyse — Apprenti Révision\n_Généré le ${date.toLocaleString('fr-FR')} — ${elapsed}s, ${iteration} itérations_\n\n---\n\n`
      fs.writeFileSync(outputPath, header + reportText, 'utf-8')
      console.log(`\n📄 Rapport sauvegardé : scripts/rapport-analyse-${timestamp}.md`)
      break
    }

    // Exécuter les tool_use appelés par l'agent
    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        const input = block.input as Record<string, string>
        const argStr = Object.entries(input)
          .map(([k, v]) => `${k}="${v}"`)
          .join(', ')
        console.log(`  → ${block.name}(${argStr})`)

        const result = executeTool(block.name, input)

        // Tronquer si trop long
        const maxLen = 12000
        const truncated =
          result.length > maxLen
            ? result.slice(0, maxLen) + `\n\n...[tronqué — ${result.length - maxLen} caractères supplémentaires]`
            : result

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: truncated,
        })
      }

      messages.push({ role: 'user', content: toolResults })
    }
  }

  if (iteration >= MAX_ITERATIONS) {
    console.log('\n⚠️  Limite d\'itérations atteinte sans rapport final.')
  }
}

// ============================================================
// POINT D'ENTRÉE
// ============================================================

runAgent().catch(err => {
  console.error('\n❌ Erreur fatale :', err)
  process.exit(1)
})
