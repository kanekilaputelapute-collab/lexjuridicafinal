export const maxDuration = 300
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

// EMAIL ADMINISTRATEUR POUR L'ACCÈS ILLIMITÉ
const ADMIN_EMAILS = ['teampush5@gmail.com'] 

async function callIA(prompt: string, model: string = 'mistral-large-latest', retries = 2, timeout = 240000) {
  const isGroq = model.includes('groq')
  const url = isGroq ? GROQ_API_URL : MISTRAL_API_URL
  const key = isGroq ? process.env.GROQ_API_KEY : process.env.MISTRAL_API_KEY

  if (!key || key === 'YOUR_MISTRAL_API_KEY' || key === 'YOUR_GROQ_API_KEY') {
    throw new Error(`Clé API ${isGroq ? 'Groq' : 'Mistral'} manquante dans .env.local`)
  }

  // Petit délai de sécurité pour éviter le spam (Rate Limit)
  await new Promise(resolve => setTimeout(resolve, 600))

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: isGroq ? 'mixtral-8x7b-32768' : model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 4096
      }),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    // Gestion du Rate Limit (429)
    if (response.status === 429 && retries > 0) {
      console.warn(`Rate limit atteint sur ${model}, attente de 2s...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
      return callIA(prompt, model, retries - 1, timeout)
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`IA Error (${response.status}): ${errorText || response.statusText}`)
    }
    
    const data = await response.json()
    return data.choices[0].message.content
  } catch (err: any) {
    clearTimeout(timeoutId)
    if (retries > 0 && err.name === 'AbortError') {
      return callIA(prompt, model, retries - 1, timeout)
    }
    throw err
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Session expirée ou non autorisée' }, { status: 401 })
    }

    const isAdmin = user.email && ADMIN_EMAILS.includes(user.email)

    // Check Energy
    const { data: stats, error: statsError } = await supabase
      .from('user_stats')
      .select('ai_energy')
      .eq('id', user.id)
      .single()

    if (statsError || !stats) {
      return NextResponse.json({ error: 'Impossible de vérifier vos quotas' }, { status: 500 })
    }

    if (!isAdmin && stats.ai_energy <= 0) {
      return NextResponse.json({ error: `Quota journalier épuisé (40/24h)` }, { status: 403 })
    }

    const body = await req.json()
    const { text, type, context, history } = body

    if (!text && type !== 'chat') {
      return NextResponse.json({ error: 'Contenu manquant' }, { status: 400 })
    }

    let systemPrompt = ''
    if (type === 'summary') {
      systemPrompt = `Tu es un tuteur juridique expert. Tu vas créer une fiche de révision synthétique et hiérarchisée à partir du cours fourni.

ÉTAPE 1 — LECTURE INTÉGRALE OBLIGATOIRE
Avant d'écrire la moindre ligne, tu dois :
1. Lire le cours en entier, jusqu'à la dernière phrase.
2. Identifier toutes les parties et sous-parties (I, II, III, A, B, a, b...).
3. Pour chaque partie, noter mentalement : les définitions, les règles, les distinctions, les exceptions, les exemples, les chiffres.
Ne commencer à rédiger qu'une fois cette lecture complète.
Contrôle obligatoire avant de commencer : liste les grandes parties identifiées en une seule ligne, puis commence la fiche. Si une partie du cours ne génère aucun contenu dans la fiche, explique pourquoi en une phrase.

ÉTAPE 2 — RÈGLE ABSOLUE ANTI-HALLUCINATION
Tu n'utilises QUE les informations explicitement présentes dans le cours.
Interdit : ajouter des précisions, exemples, exceptions ou définitions qui ne viennent pas du texte fourni.
Interdit : compléter avec tes connaissances personnelles.
Si une notion est trop peu développée, tu l'indiques en une ligne et tu passes.

ÉTAPE 3 — STRUCTURE DE LA FICHE (UTILISE DES BALISES HTML POUR LE SITE)
La fiche suit exactement le plan du cours.
- CHAQUE TITRE DE PARTIE doit être dans une balise <h3>.
- Chaque notion doit être dans une liste <ul><li>.
Structure pour chaque partie :
<h3>TITRE DE LA PARTIE</h3>
<ul>
  <li><strong>Notion-clé :</strong> résumé en 1-2 phrases denses.</li>
  <li>⚠️ <strong>Point important :</strong> règle de principe, condition, distinction ou exception.</li>
  <li>📌 <strong>À retenir :</strong> formulation courte et mémorisable.</li>
</ul>

ÉTAPE 4 — RÈGLES DE FORMAT
- Utilise exclusivement <h3>, <ul>, <li> et <strong> pour le formatage.
- Aucun commentaire sur ta propre production.
- Longueur : dense mais lisible. Ne résume pas à outrance.

ÉTAPE 5 — VÉRIFICATION FINALE
Vérifie que chaque partie est représentée, chaque règle a son exception, et aucune information externe n'est ajoutée.`
    } else if (type === 'flashcards') {
      systemPrompt = `Tu es un expert juridique et pédagogique spécialisé dans la création de flashcards pour étudiants en droit (L1-M2). Tu reçois un extrait de cours (potentiellement une partie parmi plusieurs).

ÉTAPE 1 — LECTURE ET CARTOGRAPHIE
Avant d'écrire la première flashcard :
1. Lis l'intégralité du texte fourni jusqu'à la dernière ligne.
2. Identifie toutes les parties et sous-parties (I, II, A, B, 1, 2...).
3. Liste mentalement : définitions, conditions, distinctions, règles, exceptions, articles, arrêts, délais, valeurs juridiques particulières.
4. Ne génère rien avant d'avoir fini cette lecture.

ÉTAPE 2 — RÈGLES DE GÉNÉRATION

RÈGLE 1 — EXHAUSTIVITÉ
Chaque section identifiée produit au minimum 1 flashcard, sauf si elle ne contient aucune notion définie.
Les éléments suivants doivent TOUJOURS générer une carte même s'ils semblent secondaires :
- Délais de prescription mentionnés explicitement dans le cours.
- Valeur juridique particulière d'un texte (ex : valeur constitutionnelle).
- Notions de rupture historique identifiées comme telles dans le cours.

RÈGLE 2 — ANTI-DOUBLONS (CRITIQUE)
Avant chaque carte, vérifie qu'aucune carte précédente dans ce même appel ne couvre déjà cette notion.
- Interdit : deux cartes qui testent le même fait sous des formulations différentes.
- Si une définition liste déjà les éléments constitutifs, ne recrée PAS une carte séparée sur ces mêmes éléments.
- Si une notion est déjà couverte, teste une dimension nouvelle : exception, condition, exemple concret.

RÈGLE 3 — ANTI-HALLUCINATION
Tu n'utilises QUE les informations explicitement présentes dans le texte fourni.
- Interdit : ajouter exemples, précisions ou définitions absents du texte.
- Interdit : compléter avec tes connaissances personnelles.

RÈGLE 4 — COMPLÉTUDE DES RÉPONSES
Chaque réponse est complète et autonome.
- Interdit : phrase tronquée ou incomplète.
- Si la réponse dépasse 3 lignes → la question couvre trop de notions → découpe en 2 cartes.

RÈGLE 5 — UNE NOTION PAR CARTE
Chaque flashcard porte sur UN seul angle ou distinction.
Bonne : "Quelle est la condition de domicile pour la responsabilité des parents ?"
Mauvaise : "Expliquez la responsabilité civile." (trop large)

RÈGLE 6 — PRIORITÉ DES NOTIONS (dans cet ordre)
1. Définitions fondamentales
2. Conditions et éléments constitutifs
3. Distinctions et oppositions (A vs B)
4. Règles de principe et leurs exceptions
5. Régime juridique (prescription, charge de preuve, juridiction)
6. Arrêts et articles cités dans le texte

RÈGLE 7 — CALIBRAGE DU NOMBRE
- Pas de limite fixe par page : une page dense avec 5 notions distinctes peut justifier 5 cartes ; une page de transition peut n'en justifier aucune.
- Le seul critère : chaque carte doit apporter une valeur unique. Si tu hésites entre créer ou ne pas créer → ne crée pas.
- Préfère 1 carte dense et précise à 3 cartes qui se recoupent.
- Interdit : créer une carte séparée uniquement pour citer un arrêt → intègre la référence dans la carte de la règle concernée.
- Interdit : reproduire un article de loi mot pour mot → reformule en testant la compréhension du mécanisme juridique.

RÈGLE 8 — CHRONOLOGIE DES ARRÊTS
Lorsque plusieurs arrêts sont cités pour illustrer une même règle, ne présente jamais un arrêt antérieur comme "confirmant" un arrêt postérieur.
- Interdit : "arrêt de 1927, confirmé par arrêt de 1922"
- Correct : "règle consacrée par deux arrêts fondateurs : Civ. 11 janv. 1922 (S 1924.1.105) et Civ. 26 avril 1927 (S 1927.1.201)"

RÈGLE 9 — NOTIONS DE RUPTURE HISTORIQUE
Si le cours identifie explicitement un événement ou une notion comme ayant provoqué une rupture dans l'évolution du droit (ex : apparition des dommages anonymes, Révolution industrielle), cette notion doit obligatoirement générer au moins une flashcard testant sa signification juridique et ses conséquences sur le droit.

ÉTAPE 3 — CONTRAINTE OUTPUT STRICTE
Tu es limité à 4 000 tokens de réponse. Si le texte est long :
- Priorise les notions selon la Règle 6.
- Arrête-toi proprement après la dernière carte complète.
- N'écris JAMAIS une carte dont la réponse serait tronquée faute de place.

ÉTAPE 4 — VÉRIFICATION AVANT ENVOI
□ Aucune réponse tronquée ?
□ Pas de doublons dans cet appel ?
□ Chaque carte = une seule notion ?
□ Toutes les sections couvertes, y compris délais et valeurs juridiques ?
□ Aucune information externe ajoutée ?
□ Aucun article reproduit mot pour mot ?
□ Arrêts intégrés dans la carte de leur règle, jamais isolés ?

FORMAT DE SORTIE — IMPÉRATIF
Réponds EXCLUSIVEMENT par un tableau JSON valide, sans texte avant ni après, sans backticks, sans markdown :
[{"q": "Question courte et précise ?", "a": "Réponse complète et autonome."}]`
    } else if (type === 'chat') {
      systemPrompt = `Tu es un tuteur socratique expert en droit. Guide l'élève sans donner la réponse. Context: ${context || ''}`
    }

    const fullPrompt = type === 'chat' 
      ? `${systemPrompt}\n\nHistorique: ${JSON.stringify(history)}\n\nQuestion: ${text}`
      : `${systemPrompt}\n\nTexte:\n${text}`

    let result: string
    if (type === 'chat') {
      try {
        result = await callIA(fullPrompt, 'mistral-large-latest', 2, 35000)
      } catch (e: any) {
        console.warn('Mistral fallback:', e.message)
        result = await callIA(fullPrompt, 'groq-mixtral-8x7b-32768')
      }
    } else {
      // On passe explicitement le timeout de 240000ms ici aussi
      result = await callIA(fullPrompt, 'mistral-large-latest', 2, 240000)
    }

    // Consomme l'énergie uniquement pour les non-admins
    if (!isAdmin) {
      await supabase.from('user_stats').update({ ai_energy: stats.ai_energy - 1 }).eq('id', user.id)
    }

    return NextResponse.json({ result })
  } catch (error: any) {
    console.error('CRITICAL API ERROR:', error.message)
    return NextResponse.json({ error: error.message || 'Erreur interne serveur' }, { status: 500 })
  }
}
