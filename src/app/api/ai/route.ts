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
        model: isGroq ? 'llama-3.1-8b-instant' : model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 4096
      }),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (response.status === 429 && retries > 0) {
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
Avant d'écrire la moindre ligne, tu dois lire le cours en entier.
Identifier toutes les parties et sous-parties (I, II, III, A, B, a, b...).

ÉTAPE 2 — RÈGLE ABSOLUE ANTI-HALLUCINATION
Tu n'utilises QUE les informations explicitement présentes dans le cours.
Interdit : ajouter des connaissances personnelles.

ÉTAPE 3 — STRUCTURE DE LA FICHE (UTILISE DES BALISES HTML)
La fiche suit exactement le plan du cours.
Utilise exclusivement <h3>, <ul>, <li> et <strong> pour le formatage.`
    } else if (type === 'flashcards') {
      const isPass1 = text.startsWith('[PASS1]')
      const isPass2 = text.startsWith('[PASS2]')
      const isPass3 = text.startsWith('[PASS3]')

      if (isPass1) {
        systemPrompt = `RÔLE : CERVEAU ANALYTIQUE JURIDIQUE — PASS 1 CARTOGRAPHIE

MISSION : Lire le texte et produire une cartographie EXHAUSTIVE. Tu ne génères PAS de flashcards ici.

ÉTAPES OBLIGATOIRES :
1. Reconstruis le plan exact : tous les titres, sections, sous-sections visibles dans le texte.
2. Pour chaque paragraphe, extrais TOUS les concepts clés.
   Format : "Concept : détail exact tiré du texte"
3. Extrais TOUS les arrêts cités.
   Format : "Arrêt [Nom] ([date]) : apport exact"
4. RÈGLE CRITIQUE — LISTES : Si le texte contient une liste numérotée ou à puces (conditions, postes, étapes, exceptions), tu DOIS recopier CHAQUE élément un par un. Interdit d'écrire "X conditions" sans les lister toutes.
5. RÈGLE CRITIQUE — ÉVOLUTIONS : Si une règle a évolué dans le temps, note les deux états (avant/après) séparément.

FORMAT DE SORTIE : TEXTE BRUT UNIQUEMENT, pas de JSON.
- [TITRE SECTION]
  * Concept : détail
  * Arrêt X (date) : portée
  * Condition 1 : ...
  * Condition 2 : ...`

      } else if (isPass2) {
        systemPrompt = `RÔLE : AUDITEUR JURIDIQUE CRITIQUE — PASS 2 VÉRIFICATION

MISSION : Comparer la cartographie du Pass 1 avec le texte source et détecter TOUT ce qui a été oublié. Tu ne génères PAS de flashcards ici.

ÉTAPES OBLIGATOIRES :
1. Lis la cartographie du Pass 1.
2. Relis le texte source mot par mot.
3. Pour chaque section du texte, vérifie que CHAQUE notion, condition, arrêt, exception, délai, définition est présent dans la cartographie.
4. Si quelque chose manque, ajoute-le avec le tag [MANQUANT].
5. Si une information est inexacte, corrige-la avec le tag [CORRIGÉ].
6. Si une liste est incomplète, complète-la avec le tag [COMPLÉTÉ].

FORMAT DE SORTIE : TEXTE BRUT UNIQUEMENT.
Retourne la cartographie COMPLÈTE et CORRIGÉE :
- [TITRE SECTION]
  * Concept : détail
  * [MANQUANT] Concept oublié : détail
  * [CORRIGÉ] Concept corrigé : nouvelle valeur`

      } else if (isPass3) {
        systemPrompt = `RÔLE : EXPERT PÉDAGOGIQUE JURIDIQUE — PASS 3 GÉNÉRATION

MISSION : Transformer la cartographie vérifiée en flashcards parfaites.

RÈGLES DE GÉNÉRATION :
1. EXHAUSTIVITÉ TOTALE : Chaque point de la cartographie devient au moins une flashcard. Zéro omission.
2. FIDÉLITÉ ABSOLUE : Tu ne peux écrire QUE ce qui est dans la cartographie ou le texte source. Jamais d'invention. Si tu n'es pas certain : omets la carte plutôt qu'inventer.
3. TYPOLOGIE VARIÉE : Alterne les types.
   - Définition : "Qu'est-ce que X ?"
   - Conditions : "Quelles sont les conditions de X ?"
   - Distinction : "Quelle est la différence entre X et Y ?"
   - Jurisprudence : "Quel est l'apport de l'arrêt X ?"
   - Mini-cas : "Dans quelle situation applique-t-on X ?"
4. DOUBLE ANGLE : Les notions complexes ont 2 cartes sous des angles différents.
5. DROIT TEMPOREL : Si une règle a évolué, précise toujours la période. Ex : "Depuis l'ord. 2016..." ou "Avant l'arrêt Bertrand 1997..."
6. ARRÊTS FONDATEURS : Une carte dédiée par arrêt majeur.
7. ANTI-DOUBLONS : Une seule carte par notion.
8. AUTO-VÉRIFICATION : Avant de valider une carte, vérifie :
   - Qu’elle correspond EXACTEMENT au texte source.
   - Qu’elle n’est pas redondante avec une autre carte générée dans ce bloc.

FORMAT DE SORTIE — IMPÉRATIF :
Réponds EXCLUSIVEMENT par un tableau JSON valide, sans texte avant ni après :
[{"q": "Question ?", "a": "Réponse complète et autonome."}]`

      } else {
        systemPrompt = `Tu es un expert juridique spécialisé dans la création de flashcards (L1-M2).

ÉTAPE 1 — CARTOGRAPHIE MENTALE (ne pas écrire)
Lis le texte en entier. Mémorise chaque titre, chaque liste numérotée, chaque arrêt cité.

ÉTAPE 2 — AUTOCRITIQUE MENTALE (ne pas écrire)
Demande-toi : ai-je bien vu toutes les listes ? Tous les arrêts ? Toutes les conditions et exceptions ?

ÉTAPE 3 — GÉNÉRATION
Pour chaque section du texte, génère au moins 1 carte avant de passer à la suivante.

RÈGLES :
- FIDÉLITÉ ABSOLUE : tu ne peux écrire QUE ce qui est dans le texte. Jamais d'invention.
- DROIT TEMPOREL : si une règle a évolué, précise toujours la période.
- ANTI-DOUBLONS : une seule carte par notion.
- ARRÊTS : une carte dédiée par arrêt majeur.

FORMAT DE SORTIE — IMPÉRATIF :
Réponds EXCLUSIVEMENT par un tableau JSON valide, sans texte avant ni après :
[{"q": "Question ?", "a": "Réponse."}]`
      }
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
        result = await callIA(fullPrompt, 'llama-3.1-8b-instant')
      }
    } else {
      result = await callIA(fullPrompt, 'mistral-large-latest', 2, 240000)
    }

    // Vérification de la validité du résultat avant décrémentation de l'énergie
    if (!result || result.trim().length < 10) {
      return NextResponse.json({ error: "L'IA a retourné une réponse vide ou invalide." }, { status: 502 })
    }

    if (!isAdmin) {
      await supabase.from('user_stats').update({ ai_energy: stats.ai_energy - 1 }).eq('id', user.id)
    }

    return NextResponse.json({ result })
  } catch (error: any) {
    console.error('CRITICAL API ERROR:', error.message)
    return NextResponse.json({ error: error.message || 'Erreur interne serveur' }, { status: 500 })
  }
}
