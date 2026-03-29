export const maxDuration = 60
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ADMIN_EMAILS = ['teampush5@gmail.com']

const OUTPUT_TOKENS: Record<string, number> = {
  summary_extract: 2048,
  fiche_assemble: 4096,
  flashcards: 4096,
  flashcards_pass2: 2048,
  chat: 1024,
  challenge_gen: 256,
  challenge_grade: 128,
}

const SYSTEM_PROMPTS: Record<string, string> = {
  summary_extract: "Expert juridique FR. Rôle: Extracteur de fond et de structure technique. Analyse le texte et produis un résumé respectant scrupuleusement la HIÉRARCHIE du cours. RÈGLES CRITIQUES: 1. Ne simplifie JAMAIS les critères techniques (ex: ne dis pas 'flou/précis' pour une lettre d'intention, mais cite les éléments essentiels de requalification). 2. Conserve les distinctions majeures (ex: chaînes homogènes vs hétérogènes). 3. Intègre arrêts et articles directement sous la règle. 4. Les exemples (taxis, magasins) doivent être de simples puces secondaires, pas des titres. 5. Fidélité absolue au texte, zéro hallucination.",
  fiche_assemble: "Tu es un Professeur Agrégé de Droit français. Rôle: Architecte magistral de fiche de révision. Missions: 1. Produis une structure unique, continue et logique: TITRE > CHAPITRE > SECTION > I. > II. > A. > B. 2. INTERDICTION formelle d'insérer des 'Annexes', 'Appendices' ou de redémarrer la numérotation au milieu. 3. FUSIONNE les redondances: si une notion (ex: pourparlers) est extraite plusieurs fois, traite-la en un seul point complet. 4. MAINTIEN la nuance technique: évite les raccourcis grossiers, privilégie la précision juridique sur la concision. 5. Format: HTML pur (h3, ul, li, strong).",
  flashcards: "Tu es un professeur de droit français préparant ses étudiants à l'examen.\nAnalyse le chunk de cours ci-dessous.\nObjectif : Extraire tout le FOND DU DROIT nécessaire pour l'examen.\nContenu obligatoire : Notions clés, conditions cumulatives, effets juridiques, articles de Code, délais de prescription.\nJurisprudence : Génère UNIQUEMENT des cartes pour les arrêts de principe (grands arrêts fondateurs). Ignore systématiquement les arrêts d'espèce, illustratifs ou secondaires.\nSynthèse intelligente : Si une notion a plusieurs conditions, regroupe-les dans une seule carte avec une liste (ex: 'Quelles sont les 3 conditions de X ?').\nINTERDIT : Étapes de méthode cas pratique, conseils de rédaction, ou petits arrêts de pur fait.\nRègles réponses : 1-4 lignes max. Toujours inclure article/arrêt si présent dans le chunk.\nRetourne UNIQUEMENT : [{\"q\":\"...\",\"a\":\"...\"}]\nCommence par [ immédiatement. Termine par ] immédiatement.",
  flashcards_pass2: "Tu reçois un extrait de cours juridique français ET un lot de flashcards déjà générées.\nRôle : auditeur qualité. Identifie les éléments de FOND DU DROIT majeurs non couverts :\n- Un arrêt de principe (fondateur) présent dans le texte mais oublié\n- Les conditions d'un régime juridique non traitées\n- Un article de Code central ignoré\nIgnore : méthode, petits arrêts, ou détails secondaires.\nNe régénère jamais une carte déjà présente.\nSi l'essentiel est là : retourne []\nRetourne UNIQUEMENT : [{\"q\":\"...\",\"a\":\"...\"}]",
  chat: "Tu es un tuteur socratique expert en droit français. Ton rôle est d'aider l'élève à progresser sur ses exercices (cas pratique, dissertation, commentaire d'arrêt). Ne donne jamais la réponse directement. Guide-le par des questions, rappelle les étapes de la méthodologie juridique si besoin (Faits > Problème > Majeure > Mineure > Conclusion). Utilise le contexte du cours fourni pour rester précis. Contexte : {context}",
  challenge_gen: "Génère un cas pratique de droit français : 4 lignes de faits maximum, 1 question juridique finale. Pas de corrigé. Pas de titre.",
  challenge_grade: "Note la réponse sur 20. Retourne UNIQUEMENT ce JSON : {\"score\":number,\"feedback\":\"string\"}. Rien d'autre.",
}

const TEMPERATURE: Record<string, number> = {
  summary_extract: 0.1,
  fiche_assemble: 0.1,
  flashcards: 0.1,
  flashcards_pass2: 0.1,
  chat: 0.7,
  challenge_gen: 0.5,
  challenge_grade: 0.1,
}

export async function POST(req: Request) {
  try {
    const { text, type, context, history } = await req.json()
    if (!text && type !== 'chat') return NextResponse.json({ error: "Contenu vide" }, { status: 400 })

    let systemPrompt = SYSTEM_PROMPTS[type] || ''
    if (type === 'chat' && context) {
      systemPrompt = systemPrompt.replace('{context}', context.substring(0, 5000))
    }

    let responseText = ''

    if (type === 'chat' || type === 'fiche_assemble') {
      const mistralKey = process.env.MISTRAL_API_KEY
      if (!mistralKey) return NextResponse.json({ error: "Clé Mistral absente" }, { status: 500 })

      const mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mistralKey}`
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text }
          ],
          temperature: TEMPERATURE[type] ?? 0.1,
          max_tokens: OUTPUT_TOKENS[type] ?? 1024
        })
      })

      const mistralData = await mistralRes.json()
      if (mistralData.error) throw new Error(mistralData.error.message)
      responseText = mistralData.choices?.[0]?.message?.content
    } else {
      const geminiKey = process.env.GOOGLE_GEMINI_API_KEY
      if (!geminiKey) return NextResponse.json({ error: "Clé Gemini absente" }, { status: 500 })

      const models = ["models/gemini-3.1-flash-lite-preview", "models/gemini-1.5-flash-latest"]
      let lastError = ""

      for (const model of models) {
        let attempts = 0
        const maxAttempts = 3

        while (attempts < maxAttempts) {
          try {
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${geminiKey}`
            const geminiRes = await fetch(API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `${systemPrompt}\n\nCONTENU :\n${text}` }] }],
                generationConfig: {
                  temperature: TEMPERATURE[type] ?? 0.1,
                  maxOutputTokens: OUTPUT_TOKENS[type] ?? 1024,
                  responseMimeType: (['flashcards', 'flashcards_pass2', 'challenge_grade'].includes(type)) ? "application/json" : "text/plain"
                }
              })
            })

            const geminiData = await geminiRes.json()
            if (geminiData.error) {
              const msg = geminiData.error.message
              if (msg.includes("high demand") || msg.includes("503") || msg.includes("429")) {
                attempts++; lastError = msg
                await new Promise(r => setTimeout(r, 2000 * attempts))
                continue
              }
              throw new Error(msg)
            }
            responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
            if (responseText) break
          } catch (e: any) { lastError = e.message; attempts++ }
        }
        if (responseText) break
      }
      if (!responseText) throw new Error(`Google saturé. Dernière erreur : ${lastError}`)
    }

    if (!responseText) throw new Error("IA muette")

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const isAdmin = user.email && ADMIN_EMAILS.includes(user.email)
      if (!isAdmin) {
        const { data: stats } = await supabase.from('user_stats').select('ai_energy').eq('id', user.id).single()
        if (stats && stats.ai_energy > 0) {
          await supabase.from('user_stats').update({ ai_energy: stats.ai_energy - 1 }).eq('id', user.id)
        }
      }
    }

    return NextResponse.json({ result: responseText })

  } catch (error: any) {
    console.error('IA ERROR:', error.message)
    return NextResponse.json({ error: `Erreur : ${error.message}` }, { status: 500 })
  }
}
