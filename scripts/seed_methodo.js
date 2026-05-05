const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const userId = 'cmohf50fk000a6k88biaq9yza'

const structured = {
  title: 'Méthodologie Juridique — Licence / Master',
  summary: "Ce cours couvre l'ensemble des exercices fondamentaux en droit : dissertation juridique, commentaire d'arrêt, cas pratique et consultation. Maîtriser ces méthodes est indispensable pour réussir à l'université et en pratique professionnelle.",
  plan: [
    '1. La dissertation juridique',
    '2. Le commentaire d\'arrêt',
    '3. Le cas pratique',
    '4. La consultation juridique',
    '5. La hiérarchie des normes et les sources du droit',
    '6. Le raisonnement juridique — Le syllogisme'
  ],
  sections: [
    {
      title: 'La dissertation juridique',
      notions: [
        { term: 'Problématique', definition: "Question juridique centrale qui oriente toute la démonstration. Elle doit être formulée sous forme interrogative et découler directement du sujet posé." },
        { term: 'Plan en deux parties', definition: "Structure classique en droit : deux grandes parties (I et II), chacune divisée en deux sous-parties (A et B). Chaque partie doit être équilibrée et annoncée par une transition." },
        { term: 'Introduction en entonnoir', definition: "Accroche → définition des termes → délimitation du sujet → intérêt du sujet → problématique → annonce du plan." },
        { term: 'Chapeau', definition: "Phrase de transition entre deux parties qui rappelle la conclusion de la partie précédente et annonce la suivante. Obligatoire entre I et II." },
        { term: 'Intitulés de plan', definition: "Les titres de parties et sous-parties doivent être substantifs (groupe nominal), jamais des phrases verbales. Ex : 'La primauté du contrat sur la loi' et non 'Le contrat prime sur la loi'." }
      ],
      points: [
        "L'accroche doit être juridique ou d'actualité — jamais une généralité philosophique ou historique vague.",
        "Définir chaque terme du sujet avec précision juridique, même les termes apparemment évidents.",
        "La problématique ne se pose pas : elle se dégage. Elle répond à une tension, une ambiguïté ou une évolution du droit.",
        "Le plan doit être apparent et logique : les intitulés sont substantifs, jamais des phrases verbales.",
        "Chaque sous-partie (A et B) contient : une annonce, le développement avec des références légales/jurisprudentielles, une mini-conclusion.",
        "La conclusion n'existe pas en dissertation juridique — la dernière sous-partie sert de conclusion implicite.",
        "Bannir les formules vagues : 'il convient de noter que', 'nous allons voir que', 'il est important de souligner'.",
        "Le plan doit être bipartite et équilibré : jamais un I avec 5 pages et un II avec 1 page.",
        "La transition (chapeau) entre I et II est obligatoire : elle clôt le I et annonce le II en une à deux phrases.",
        "Les références : citer les articles de code (ex : art. 1240 C. civ.), les arrêts (ex : Cass. civ. 1re, 13 oct. 1998), les lois (ex : L. n° 2016-1547 du 18 nov. 2016)."
      ],
      retenir: "Dissertation = démonstration d'une thèse juridique argumentée. Le plan est la réponse à la problématique, découpée en deux temps logiques et équilibrés."
    },
    {
      title: "Le commentaire d'arrêt",
      notions: [
        { term: "Fiche d'arrêt", definition: "Analyse préliminaire : juridiction, date, faits, procédure, thèse des parties, question de droit, solution. Elle sert à comprendre avant de commenter — ne pas la reproduire dans le devoir." },
        { term: 'Ratio decidendi', definition: "Motif déterminant de la décision, le raisonnement juridique sur lequel se fonde le juge pour trancher. C'est le cœur du commentaire." },
        { term: "Apport de l'arrêt", definition: "Ce que l'arrêt apporte au droit : confirmation, revirement, précision, restriction, extension d'une règle. À identifier dès la lecture." },
        { term: "Portée de l'arrêt", definition: "Conséquences pratiques et théoriques de la décision : généralité ou particularité, impact sur la jurisprudence future, réaction doctrinale." },
        { term: 'Revirement de jurisprudence', definition: "Changement de solution par rapport à la jurisprudence antérieure. Doit être signalé et expliqué dans le commentaire en confrontant les deux solutions." }
      ],
      points: [
        "JAMAIS raconter les faits dans le commentaire — la fiche d'arrêt est préparatoire, non intégrée dans le devoir.",
        "L'introduction : accroche (notion de droit), présentation de l'arrêt en une phrase, intérêt de l'arrêt, problématique, annonce du plan.",
        "La problématique porte sur l'apport juridique de l'arrêt, pas sur les faits.",
        "Plan type I : 'La solution retenue par la Cour' / II : 'La portée de cette solution'. Ou : I. 'L'affirmation d'un principe' / II. 'Les limites de ce principe'.",
        "Chaque développement confronte l'arrêt aux textes (Code civil, lois), à la jurisprudence antérieure, et à la doctrine.",
        "Vocabulaire technique : la Cour de cassation 'casse' ou 'rejette', la Cour d'appel 'infirme' ou 'confirme', le Conseil d'État 'annule' ou 'rejette'.",
        "Citer entre guillemets les formules clés de l'arrêt pour les analyser mot à mot.",
        "Identifier si l'arrêt est rendu en formation solennelle (chambre mixte, assemblée plénière) — signe d'une importance particulière.",
        "Mentionner si l'arrêt est publié au Bulletin (arrêt de principe) ou non publié (espèce particulière)."
      ],
      retenir: "Commenter = expliquer ce que le juge a décidé, pourquoi, et ce que ça change dans le droit. Pas de récit des faits, mais une analyse juridique en confrontation avec les sources."
    },
    {
      title: 'Le cas pratique',
      notions: [
        { term: 'Syllogisme juridique', definition: "Raisonnement en trois temps : Majeure (règle de droit) → Mineure (application aux faits) → Conclusion. Structure obligatoire et répétée pour chaque problème identifié." },
        { term: 'Qualification juridique', definition: "Opération qui rattache des faits concrets à une catégorie juridique abstraite. Ex : identifier un contrat de vente, un fait générateur de responsabilité délictuelle." },
        { term: 'Identification des problèmes de droit', definition: "Première étape : lire les faits et lister toutes les questions juridiques posées. Chaque problème donne lieu à un syllogisme distinct." }
      ],
      points: [
        "Étape 1 — Identifier les faits pertinents : écarter les détails sans portée juridique, retenir ce qui fonde droits et obligations.",
        "Étape 2 — Qualifier juridiquement les faits : donner leur nature exacte (contrat, délit, créance, propriété, etc.).",
        "Étape 3 — Identifier la ou les règles de droit applicables : articles de code, jurisprudence constante, textes spéciaux.",
        "Étape 4 — Appliquer la règle aux faits (mineure) : rédiger 'En l'espèce...' en reprenant les éléments concrets.",
        "Étape 5 — Conclure : énoncer la solution et les recours possibles pour la partie que vous conseillez.",
        "Ne jamais inventer des faits non mentionnés. Si l'info manque, signaler : 'Si tel est le cas, alors...' ou 'Sous réserve que...'.",
        "Formules indispensables : 'En l'espèce', 'Or', 'Par conséquent', 'Il convient donc de', 'M. X sera fondé à / ne pourra pas...'.",
        "En master : anticiper les arguments adverses, évaluer les chances de succès, proposer une alternative amiable si pertinent.",
        "Traiter les problèmes dans l'ordre chronologique ou par ordre logique (questions préliminaires avant questions de fond)."
      ],
      retenir: "Cas pratique = résoudre un litige concret en appliquant le droit méthodiquement. Partir de la règle pour aller vers les faits. Un syllogisme par problème identifié."
    },
    {
      title: 'La consultation juridique',
      notions: [
        { term: 'Consultation', definition: "Exercice de master simulant l'avis d'un avocat à son client. Plus élaborée que le cas pratique : on analyse les risques, les chances de succès, les stratégies procédurales et alternatives." },
        { term: 'Analyse des risques', definition: "Évaluation des probabilités de succès d'une prétention, en tenant compte de la jurisprudence récente, des incertitudes du droit et des faits disponibles." },
        { term: 'Conseils procéduraux', definition: "Recommandations sur la juridiction compétente, les délais de prescription, les modes de preuve, les voies de recours possibles et leur efficacité." },
        { term: 'MARC', definition: "Modes Alternatifs de Règlement des Conflits : médiation, conciliation, arbitrage. À envisager systématiquement avant le contentieux judiciaire." }
      ],
      points: [
        "La consultation s'adresse au client : ton style doit être clair, pratique, orienté vers l'action concrète.",
        "Structure type : I. Analyse de la situation juridique / II. Recommandations et stratégie à adopter.",
        "Toujours préciser la juridiction compétente : TJ (droit commun civil), CPH (droit du travail), TA (droit administratif), TC (droit commercial).",
        "Mentionner les délais de prescription applicables : droit commun = 5 ans (art. 2224 C. civ.), délits = 3 ans, etc.",
        "Peser le pour et le contre : coût de la procédure, durée, chances de succès, impact sur la relation commerciale.",
        "Toujours envisager les MARC avant le contentieux : la médiation est obligatoire dans certains litiges (< 5 000 €).",
        "En master 2, intégrer si pertinent une analyse de droit européen ou comparé, et la jurisprudence de la CEDH.",
        "La consultation se conclut par une recommandation claire et hiérarchisée : option principale, option subsidiaire."
      ],
      retenir: "La consultation est l'exercice le plus proche de la pratique professionnelle : on conseille un client réel, on anticipe les risques, on propose une stratégie complète."
    },
    {
      title: 'La hiérarchie des normes et les sources du droit',
      notions: [
        { term: 'Pyramide de Kelsen', definition: "Hiérarchie normative : Constitution → Traités internationaux → Lois organiques → Lois ordinaires → Règlements (décrets, arrêtés) → Actes individuels. Toute norme inférieure doit être conforme aux normes supérieures." },
        { term: 'Bloc de constitutionnalité', definition: "Ensemble des normes de valeur constitutionnelle contrôlées par le Conseil constitutionnel : Constitution 1958, Préambule 1946, DDHC 1789, Charte de l'environnement 2004, PFRLR." },
        { term: 'Primauté du droit de l\'UE', definition: "Le droit européen prime sur le droit national (CJCE, Costa c. ENEL, 1964). Les règlements sont directement applicables ; les directives nécessitent transposition mais ont un effet direct vertical si non transposées." },
        { term: 'Question Prioritaire de Constitutionnalité (QPC)', definition: "Mécanisme créé en 2010 permettant à tout justiciable de contester la constitutionnalité d'une disposition législative devant n'importe quelle juridiction." },
        { term: 'Article 55 de la Constitution', definition: "Les traités régulièrement ratifiés ont une autorité supérieure à celle des lois. Permet aux juges ordinaires d'écarter une loi contraire à un traité (contrôle de conventionnalité)." }
      ],
      points: [
        "La Constitution de 1958 est au sommet de la hiérarchie interne, mais les traités la complètent via l'article 55.",
        "Les règlements européens sont directement applicables sans transposition dans tous les États membres.",
        "Seul le Conseil constitutionnel peut annuler une loi inconstitutionnelle — le juge ordinaire peut seulement l'écarter.",
        "Le contrôle de conventionnalité (art. 55 C.) est exercé par tous les juges — pas seulement le CC.",
        "En droit administratif, le bloc de légalité comprend aussi les principes généraux du droit (PGD) dégagés par le Conseil d'État.",
        "Conflit de normes : lex specialis derogat legi generali (loi spéciale prime loi générale) ; lex posterior derogat legi priori (loi postérieure prime loi antérieure)."
      ],
      retenir: "La hiérarchie des normes est le fondement de tout raisonnement juridique : appliquer la règle pertinente au bon niveau de la pyramide, en vérifiant sa conformité aux normes supérieures."
    },
    {
      title: 'Le raisonnement juridique — Le syllogisme',
      notions: [
        { term: 'Majeure', definition: "La règle de droit abstraite et générale applicable au cas. Formulée précisément avec sa source (numéro d'article, Code, jurisprudence, date)." },
        { term: 'Mineure', definition: "L'application concrète de la règle aux faits de l'espèce. Commence par 'En l'espèce, ...' ou 'Or, en l'espèce...'. C'est ici qu'on intègre les faits." },
        { term: 'Conclusion', definition: "La solution qui découle logiquement de l'application de la règle aux faits. Doit être ferme, précise et directement utile pour la personne conseillée." },
        { term: 'Interprétation téléologique', definition: "Méthode qui recherche la finalité du texte : quel objectif poursuivait le législateur ? Utilisée quand le texte est ambiguë ou lacunaire." },
        { term: 'Interprétation littérale (exégétique)', definition: "Méthode qui s'en tient au sens grammatical strict du texte. En droit pénal, elle est imposée par le principe d'interprétation stricte de la loi pénale." },
        { term: 'Analogie (raisonnement a pari)', definition: "Application d'une règle prévue pour un cas à un cas similaire non prévu. Permise en droit privé, interdite en droit pénal et en droit fiscal (principe de légalité)." }
      ],
      points: [
        "Le syllogisme est la colonne vertébrale de tout écrit juridique : dissertation, commentaire, cas pratique, consultation.",
        "Exemple complet — Majeure : 'L'article 1240 C. civ. dispose que tout fait quelconque de l'homme causant un dommage à autrui oblige son auteur à le réparer.' Mineure : 'En l'espèce, X a renversé Y par imprudence, causant un préjudice corporel.' Conclusion : 'X est donc tenu de réparer le préjudice de Y sur le fondement de la responsabilité délictuelle.'",
        "Un bon juriste applique le droit positif rigoureusement, même si la solution lui semble injuste — il peut proposer une réforme en conclusion.",
        "L'interprétation restrictive s'impose en droit pénal (art. 111-4 C. pén.), en droit fiscal, et pour les exceptions aux principes.",
        "En cas de vide juridique, le juge peut : appliquer par analogie, recourir aux PGD, solliciter la doctrine, appliquer l'équité (en matière d'arbitrage).",
        "La motivation des décisions de justice (depuis la réforme de 2019 à la Cour de cassation) tend vers une motivation enrichie, plus proche du syllogisme explicite."
      ],
      retenir: "Le syllogisme juridique est universel : Règle → Faits → Solution. Appliquer cette structure systématiquement à chaque question posée est la marque d'un juriste rigoureux."
    }
  ]
}

const rawContent = structured.sections.map(s =>
  s.title + '\n' + s.points.join('\n')
).join('\n\n')

p.course.create({
  data: {
    title: structured.title,
    rawContent,
    structuredContent: structured,
    status: 'ready',
    userId
  }
}).then(c => {
  console.log('Cours cree ID:', c.id)
  return p.$disconnect()
}).catch(e => {
  console.error('Erreur:', e.message)
  p.$disconnect()
})
