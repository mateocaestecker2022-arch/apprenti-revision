/**
 * ANALYSE STATIQUE — APPRENTI RÉVISION
 *
 * Vérifie les règles R1-R10 + bugs courants sans API externe.
 * Usage : npx tsx scripts/analyze-static.ts
 */

import * as fs from 'fs'
import * as path from 'path'

const PROJECT_ROOT = path.join(__dirname, '..')

// ============================================================
// TYPES
// ============================================================

type Severity = 'CRITIQUE' | 'MAJEUR' | 'MINEUR'

interface Finding {
  severity: Severity
  rule: string
  title: string
  file: string
  line?: number
  detail: string
  suggestion: string
}

const findings: Finding[] = []

function report(f: Finding) {
  findings.push(f)
}

// ============================================================
// UTILITAIRES
// ============================================================

function readFile(rel: string): string | null {
  const full = path.join(PROJECT_ROOT, rel)
  if (!fs.existsSync(full)) return null
  return fs.readFileSync(full, 'utf-8')
}

function walkTs(dir: string, results: string[] = []): string[] {
  if (!fs.existsSync(dir)) return results
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkTs(full, results)
    else if (entry.name.match(/\.(ts|tsx)$/)) results.push(full)
  }
  return results
}

function relPath(abs: string): string {
  return abs.replace(PROJECT_ROOT + path.sep, '').replace(/\\/g, '/')
}

function findLine(content: string, pattern: string | RegExp): number {
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (typeof pattern === 'string' ? lines[i].includes(pattern) : pattern.test(lines[i])) {
      return i + 1
    }
  }
  return 0
}

function findAllLines(content: string, pattern: string | RegExp): number[] {
  const lines = content.split('\n')
  const result: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (typeof pattern === 'string' ? lines[i].includes(pattern) : pattern.test(lines[i])) {
      result.push(i + 1)
    }
  }
  return result
}

// ============================================================
// RÈGLES
// ============================================================

function checkR1_NextAuth(files: string[]) {
  // R1 : utiliser auth() depuis @/lib/auth, jamais getServerSession
  for (const abs of files) {
    const rel = relPath(abs)
    if (rel.startsWith('scripts/')) continue
    const content = readFile(rel)
    if (!content) continue
    const lines = findAllLines(content, 'getServerSession')
    for (const line of lines) {
      report({
        severity: 'CRITIQUE',
        rule: 'R1',
        title: 'getServerSession() utilisé (NextAuth v4)',
        file: rel,
        line,
        detail: 'getServerSession() est l\'API NextAuth v4 — ce projet utilise NextAuth v5.',
        suggestion: 'Remplacer par `const session = await auth()` depuis @/lib/auth',
      })
    }
  }
}

function checkR2_PrismaClient(files: string[]) {
  // R2 : jamais new PrismaClient() hors de lib/prisma.ts et worker.ts
  for (const abs of files) {
    const rel = relPath(abs)
    if (rel === 'src/lib/prisma.ts' || rel === 'worker.ts' || rel.startsWith('scripts/')) continue
    const content = readFile(rel)
    if (!content) continue
    const lines = findAllLines(content, 'new PrismaClient()')
    for (const line of lines) {
      report({
        severity: 'CRITIQUE',
        rule: 'R2',
        title: 'new PrismaClient() hors du singleton',
        file: rel,
        line,
        detail: 'Instancier PrismaClient dans une route → pool de connexions qui explose en prod.',
        suggestion: 'Importer `prisma` depuis @/lib/prisma',
      })
    }
  }
}

function checkR3_Redis(files: string[]) {
  // R3 : jamais new Redis() hors de lib/redis.ts et worker.ts
  for (const abs of files) {
    const rel = relPath(abs)
    if (rel === 'src/lib/redis.ts' || rel === 'worker.ts' || rel.startsWith('scripts/')) continue
    const content = readFile(rel)
    if (!content) continue
    const lines = findAllLines(content, /new Redis\(/)
    for (const line of lines) {
      report({
        severity: 'MAJEUR',
        rule: 'R3',
        title: 'new Redis() hors du singleton',
        file: rel,
        line,
        detail: 'Plusieurs instances Redis en parallèle = connexions inutiles.',
        suggestion: 'Importer `redis` depuis @/lib/redis',
      })
    }
  }
}

function checkR4_Auth(files: string[]) {
  // R4 : routes API doivent vérifier la session
  const apiDir = path.join(PROJECT_ROOT, 'src', 'app', 'api')
  for (const abs of files) {
    const rel = relPath(abs)
    if (!rel.startsWith('src/app/api/')) continue
    // Exclure les routes publiques
    if (
      rel.includes('/auth/') ||
      rel.includes('/register') ||
      rel.includes('/forgot-password') ||
      rel.includes('/reset-password')
    ) continue
    const content = readFile(rel)
    if (!content) continue
    const hasAuth = content.includes('auth()') || content.includes('getServerSession')
    if (!hasAuth) {
      report({
        severity: 'MAJEUR',
        rule: 'R4',
        title: 'Route API sans vérification d\'auth',
        file: rel,
        detail: 'Aucun appel à auth() détecté — la route pourrait être accessible sans être connecté.',
        suggestion: 'Ajouter `const session = await auth()` en début de handler + return 401 si null',
      })
    }
  }
}

function checkR5_TryCatch(files: string[]) {
  // R5 : chaque route API doit avoir un try/catch
  for (const abs of files) {
    const rel = relPath(abs)
    if (!rel.startsWith('src/app/api/')) continue
    const content = readFile(rel)
    if (!content) continue
    if (!content.includes('try {') && !content.includes('try{')) {
      report({
        severity: 'MAJEUR',
        rule: 'R5',
        title: 'Route API sans try/catch',
        file: rel,
        detail: 'Une exception non catchée retourne une 500 sans message propre.',
        suggestion: 'Encapsuler le handler dans try { ... } catch (error) { return NextResponse.json({ error: "Erreur serveur" }, { status: 500 }) }',
      })
    }
  }
}

function checkR6_WorkerStatus() {
  // R6 : le worker doit mettre status "error" dans son catch
  const content = readFile('worker.ts')
  if (!content) return
  // Cherche les blocs catch qui ne contiennent pas status: 'error'
  const catchBlocks = content.split('} catch')
  for (let i = 1; i < catchBlocks.length; i++) {
    const block = catchBlocks[i].slice(0, 500)
    if (!block.includes("status: 'error'") && !block.includes('status: "error"')) {
      const linesBefore = content.split('} catch').slice(0, i).join('} catch').split('\n').length
      report({
        severity: 'CRITIQUE',
        rule: 'R6',
        title: 'Catch dans worker sans mise à jour status "error"',
        file: 'worker.ts',
        line: linesBefore,
        detail: 'Si une exception n\'est pas catchée avec status "error", le cours reste bloqué en "processing" indéfiniment.',
        suggestion: 'Ajouter prisma.course.update({ data: { status: "error" } }) dans chaque catch du worker',
      })
    }
  }
}

function checkR8_JsonParsing(files: string[]) {
  // R8 : JSON.parse sans regex préalable ou sans try/catch
  for (const abs of files) {
    const rel = relPath(abs)
    if (!rel.startsWith('src/app/api/') && rel !== 'worker.ts') continue
    const content = readFile(rel)
    if (!content) continue
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes('JSON.parse')) continue
      // Vérifier si dans un try/catch — chercher "try {" dans les 20 lignes précédentes
      const context = lines.slice(Math.max(0, i - 20), i).join('\n')
      if (!context.includes('try {') && !context.includes('try{')) {
        report({
          severity: 'MAJEUR',
          rule: 'R8',
          title: 'JSON.parse sans try/catch',
          file: rel,
          line: i + 1,
          detail: 'JSON.parse peut lever une exception si la réponse Groq est malformée.',
          suggestion: 'Encapsuler dans try { JSON.parse(...) } catch { ... }',
        })
      }
    }
  }
}

function checkIDOR(files: string[]) {
  // Cherche des delete/update sans vérification userId
  for (const abs of files) {
    const rel = relPath(abs)
    if (!rel.startsWith('src/app/api/')) continue
    const content = readFile(rel)
    if (!content) continue
    if (!content.includes('DELETE') && !content.includes('PATCH') && !content.includes('PUT')) continue
    // Si on fait un update/delete Prisma sans where userId
    const hasDelete = content.includes('prisma.') && (content.includes('.delete(') || content.includes('.update('))
    const hasUserIdCheck = content.includes('userId') || content.includes('user.id') || content.includes('session.user')
    if (hasDelete && !hasUserIdCheck) {
      report({
        severity: 'CRITIQUE',
        rule: 'IDOR',
        title: 'Mutation Prisma sans vérification userId potentielle',
        file: rel,
        detail: 'Une route DELETE/PATCH/PUT fait une mutation Prisma sans userId détecté — risque IDOR (accès à la ressource d\'un autre user).',
        suggestion: 'S\'assurer que le where clause inclut userId: session.user.id',
      })
    }
  }
}

function checkSecrets(files: string[]) {
  // Cherche des clés API en dur
  const patterns = [
    /sk-[a-zA-Z0-9]{20,}/,
    /gsk_[a-zA-Z0-9]{20,}/,
    /GROQ_API_KEY\s*=\s*["'][^"']+["']/,
    /ANTHROPIC_API_KEY\s*=\s*["'][^"']+["']/,
  ]
  for (const abs of files) {
    const rel = relPath(abs)
    if (rel.startsWith('scripts/')) continue
    const content = readFile(rel)
    if (!content) continue
    for (const pattern of patterns) {
      const line = findLine(content, pattern)
      if (line > 0) {
        report({
          severity: 'CRITIQUE',
          rule: 'SECRET',
          title: 'Clé API potentiellement en dur',
          file: rel,
          line,
          detail: 'Une clé API semble être codée en dur dans le source.',
          suggestion: 'Utiliser process.env.MA_CLE et la stocker dans .env (non commité)',
        })
      }
    }
  }
}

function checkAwaitMissing(files: string[]) {
  // Cherche des appels Prisma/Groq sans await
  const patterns = [
    /(?<!await\s)prisma\.\w+\.\w+\(/,
    /(?<!await\s)groq\.chat\.completions\.create\(/,
  ]
  for (const abs of files) {
    const rel = relPath(abs)
    if (rel.startsWith('scripts/')) continue
    const content = readFile(rel)
    if (!content) continue
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue
      for (const pattern of patterns) {
        if (pattern.test(line) && !line.includes('await ') && !line.includes('return ') && !line.includes('const ') && !line.includes('//')) {
          // Skip si la ligne précédente a un await ou est une déclaration
          const prev = i > 0 ? lines[i - 1] : ''
          if (prev.includes('await')) continue
          report({
            severity: 'MAJEUR',
            rule: 'AWAIT',
            title: 'await potentiellement manquant',
            file: rel,
            line: i + 1,
            detail: `Appel async sans await détecté : ${line.trim().slice(0, 80)}`,
            suggestion: 'Vérifier si await est nécessaire',
          })
        }
      }
    }
  }
}

function checkUseClientServerImport(files: string[]) {
  // Composants "use client" qui importent depuis lib/ serveur
  const serverOnlyLibs = ['@/lib/prisma', '@/lib/auth', '@/lib/redis', '@/lib/queue']
  for (const abs of files) {
    const rel = relPath(abs)
    const content = readFile(rel)
    if (!content) continue
    if (!content.startsWith('"use client"') && !content.startsWith("'use client'")) continue
    for (const lib of serverOnlyLibs) {
      if (content.includes(`from '${lib}'`) || content.includes(`from "${lib}"`)) {
        const line = findLine(content, lib)
        report({
          severity: 'CRITIQUE',
          rule: 'CLIENT',
          title: `"use client" importe un module serveur (${lib})`,
          file: rel,
          line,
          detail: `${lib} est un module serveur (Prisma, Redis, etc.) — l\'importer dans un Client Component causera une erreur.`,
          suggestion: 'Passer les données via props depuis un Server Component, ou utiliser une route API',
        })
      }
    }
  }
}

// ============================================================
// RAPPORT
// ============================================================

function generateReport(files: string[], elapsed: number): string {
  const critiques = findings.filter(f => f.severity === 'CRITIQUE')
  const majeurs = findings.filter(f => f.severity === 'MAJEUR')
  const mineurs = findings.filter(f => f.severity === 'MINEUR')

  let md = `# Rapport d'analyse statique — Apprenti Révision\n`
  md += `_Généré le ${new Date().toLocaleString('fr-FR')} — ${elapsed}s — ${files.length} fichiers analysés_\n\n---\n\n`

  md += `## Résumé\n`
  md += `- **${files.length}** fichiers analysés\n`
  md += `- **${critiques.length}** problèmes critiques\n`
  md += `- **${majeurs.length}** problèmes majeurs\n`
  md += `- **${mineurs.length}** problèmes mineurs\n\n---\n\n`

  if (findings.length === 0) {
    md += `## Aucun problème détecté\n\nLe code respecte toutes les règles vérifiées.\n`
    return md
  }

  for (const f of [...critiques, ...majeurs, ...mineurs]) {
    md += `### [${f.severity}] ${f.title}\n`
    md += `- **Règle :** ${f.rule}\n`
    md += `- **Fichier :** \`${f.file}${f.line ? `:${f.line}` : ''}\`\n`
    md += `- **Problème :** ${f.detail}\n`
    md += `- **Suggestion :** ${f.suggestion}\n\n`
  }

  md += `---\n\n## Conclusion\n`
  if (critiques.length > 0) {
    md += `**⚠️ ${critiques.length} problème(s) critique(s) à corriger en priorité.**\n`
  } else if (majeurs.length > 0) {
    md += `**Pas de critique. ${majeurs.length} point(s) majeur(s) à adresser.**\n`
  } else {
    md += `**Bonne santé globale du code.**\n`
  }

  return md
}

// ============================================================
// MAIN
// ============================================================

function main() {
  const start = Date.now()
  console.log('\n' + '═'.repeat(55))
  console.log('  ANALYSE STATIQUE — APPRENTI RÉVISION')
  console.log('═'.repeat(55))

  const srcFiles = walkTs(path.join(PROJECT_ROOT, 'src'))
  const workerFile = path.join(PROJECT_ROOT, 'worker.ts')
  if (fs.existsSync(workerFile)) srcFiles.push(workerFile)

  const scriptFiles = walkTs(path.join(PROJECT_ROOT, 'scripts'))
  const allFiles = [...srcFiles, ...scriptFiles]

  console.log(`  ${allFiles.length} fichiers TypeScript trouvés\n`)

  console.log('  Vérification des règles...')
  checkR1_NextAuth(allFiles)
  checkR2_PrismaClient(allFiles)
  checkR3_Redis(allFiles)
  checkR4_Auth(allFiles)
  checkR5_TryCatch(allFiles)
  checkR6_WorkerStatus()
  checkR8_JsonParsing(allFiles)
  checkIDOR(allFiles)
  checkSecrets(allFiles)
  checkAwaitMissing(allFiles)
  checkUseClientServerImport(allFiles)

  const elapsed = Math.round((Date.now() - start) / 1000)

  const critiques = findings.filter(f => f.severity === 'CRITIQUE').length
  const majeurs = findings.filter(f => f.severity === 'MAJEUR').length
  console.log(`\n  Résultat : ${critiques} critiques, ${majeurs} majeurs, ${findings.filter(f => f.severity === 'MINEUR').length} mineurs`)

  const report = generateReport(allFiles, elapsed)

  // Afficher dans le terminal
  console.log('\n' + '═'.repeat(55) + '\n')
  console.log(report)

  // Sauvegarder en .md
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outPath = path.join(PROJECT_ROOT, 'scripts', `rapport-statique-${timestamp}.md`)
  fs.writeFileSync(outPath, report, 'utf-8')
  console.log(`\n📄 Rapport sauvegardé : scripts/rapport-statique-${timestamp}.md`)
}

main()
