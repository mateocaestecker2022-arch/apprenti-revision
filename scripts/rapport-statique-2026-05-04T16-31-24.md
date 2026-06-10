# Rapport d'analyse statique — Apprenti Révision
_Généré le 04/05/2026 18:31:24 — 0s — 42 fichiers analysés_

---

## Résumé
- **42** fichiers analysés
- **5** problèmes critiques
- **5** problèmes majeurs
- **0** problèmes mineurs

---

### [CRITIQUE] Catch dans worker sans mise à jour status "error"
- **Règle :** R6
- **Fichier :** `worker.ts:69`
- **Problème :** Si une exception n'est pas catchée avec status "error", le cours reste bloqué en "processing" indéfiniment.
- **Suggestion :** Ajouter prisma.course.update({ data: { status: "error" } }) dans chaque catch du worker

### [CRITIQUE] Catch dans worker sans mise à jour status "error"
- **Règle :** R6
- **Fichier :** `worker.ts:465`
- **Problème :** Si une exception n'est pas catchée avec status "error", le cours reste bloqué en "processing" indéfiniment.
- **Suggestion :** Ajouter prisma.course.update({ data: { status: "error" } }) dans chaque catch du worker

### [CRITIQUE] Catch dans worker sans mise à jour status "error"
- **Règle :** R6
- **Fichier :** `worker.ts:481`
- **Problème :** Si une exception n'est pas catchée avec status "error", le cours reste bloqué en "processing" indéfiniment.
- **Suggestion :** Ajouter prisma.course.update({ data: { status: "error" } }) dans chaque catch du worker

### [CRITIQUE] Catch dans worker sans mise à jour status "error"
- **Règle :** R6
- **Fichier :** `worker.ts:509`
- **Problème :** Si une exception n'est pas catchée avec status "error", le cours reste bloqué en "processing" indéfiniment.
- **Suggestion :** Ajouter prisma.course.update({ data: { status: "error" } }) dans chaque catch du worker

### [CRITIQUE] Catch dans worker sans mise à jour status "error"
- **Règle :** R6
- **Fichier :** `worker.ts:536`
- **Problème :** Si une exception n'est pas catchée avec status "error", le cours reste bloqué en "processing" indéfiniment.
- **Suggestion :** Ajouter prisma.course.update({ data: { status: "error" } }) dans chaque catch du worker

### [MAJEUR] Route API sans try/catch
- **Règle :** R5
- **Fichier :** `src/app/api/auth/[...nextauth]/route.ts`
- **Problème :** Une exception non catchée retourne une 500 sans message propre.
- **Suggestion :** Encapsuler le handler dans try { ... } catch (error) { return NextResponse.json({ error: "Erreur serveur" }, { status: 500 }) }

### [MAJEUR] JSON.parse sans try/catch
- **Règle :** R8
- **Fichier :** `worker.ts:439`
- **Problème :** JSON.parse peut lever une exception si la réponse Groq est malformée.
- **Suggestion :** Encapsuler dans try { JSON.parse(...) } catch { ... }

### [MAJEUR] JSON.parse sans try/catch
- **Règle :** R8
- **Fichier :** `worker.ts:450`
- **Problème :** JSON.parse peut lever une exception si la réponse Groq est malformée.
- **Suggestion :** Encapsuler dans try { JSON.parse(...) } catch { ... }

### [MAJEUR] JSON.parse sans try/catch
- **Règle :** R8
- **Fichier :** `worker.ts:481`
- **Problème :** JSON.parse peut lever une exception si la réponse Groq est malformée.
- **Suggestion :** Encapsuler dans try { JSON.parse(...) } catch { ... }

### [MAJEUR] await potentiellement manquant
- **Règle :** AWAIT
- **Fichier :** `src/app/dashboard/page.tsx:18`
- **Problème :** Appel async sans await détecté : prisma.folder.findMany({
- **Suggestion :** Vérifier si await est nécessaire

---

## Conclusion
**⚠️ 5 problème(s) critique(s) à corriger en priorité.**
