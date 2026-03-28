'use client'
import { useState, useEffect } from 'react'
import { Upload, CheckCircle2, Loader2, PartyPopper } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import mammoth from 'mammoth'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

// Seuils calibrés pour Mistral Large (128K tokens context, 4096 tokens output)
// 90 000 chars ≈ 67 000 tokens — safe pour tenir dans le contexte avec le prompt système
const SINGLE_CALL_LIMIT = 60000
const CHUNK_SIZE = 45000

const ADMIN_EMAILS = ['teampush5@gmail.com']

function findBestCutPoint(text: string, targetEnd: number): number {
  // Zone de recherche : 5000 chars avant la limite cible
  const searchStart = Math.max(0, targetEnd - 5000)
  const searchZone = text.slice(searchStart, targetEnd)

  // PRIORITÉ 1 — Titre de section (I, II, III, A), B), 1., 2. en début de ligne)
  const sectionPatterns = [
    /\n(?=[IVX]+[\s\.\-–])/g,
    /\n(?=[A-Z]\))/g,
    /\n(?=\d+[\.\)]\s)/g,
  ]
  for (const pattern of sectionPatterns) {
    const matches = [...searchZone.matchAll(pattern)]
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1]
      return searchStart + (lastMatch.index ?? 0)
    }
  }

  // PRIORITÉ 2 — Double saut de ligne (séparation entre paragraphes)
  const doubleNewline = searchZone.lastIndexOf('\n\n')
  if (doubleNewline !== -1) {
    return searchStart + doubleNewline
  }

  // PRIORITÉ 3 — Fin de phrase suivie d'un saut de ligne
  const sentenceEnd = searchZone.lastIndexOf('.\n')
  if (sentenceEnd !== -1) {
    return searchStart + sentenceEnd + 1
  }

  // PRIORITÉ 4 — Dernier espace (jamais couper au milieu d'un mot)
  const lastSpace = searchZone.lastIndexOf(' ')
  if (lastSpace !== -1) {
    return searchStart + lastSpace
  }

  // FALLBACK — Coupe à la limite fixe (cas extrême)
  return targetEnd
}

function splitIntoChunks(text: string, debug = false): string[] {
  if (debug) console.log(`%c[DEBUG CHUNKING] Taille totale du texte : ${text.length} caractères`, 'color: #c9a84c; font-weight: bold')
  
  // Cours court : 1 seul appel, pas de doublons inter-chunks
  if (text.length <= SINGLE_CALL_LIMIT) {
    if (debug) console.log('%c[DEBUG CHUNKING] Texte court détecté. Un seul chunk sera utilisé.', 'color: #4ade80')
    return [text]
  }

  const chunks: string[] = []
  let start = 0
  let index = 0
  const totalEstimated = Math.ceil(text.length / CHUNK_SIZE)

  while (start < text.length) {
    const rawEnd = Math.min(start + CHUNK_SIZE, text.length)

    // Si on est à la fin du texte, pas besoin de chercher un point de coupe
    const cutPoint = rawEnd === text.length
      ? rawEnd
      : findBestCutPoint(text, rawEnd)

    const chunkContent = text.slice(start, cutPoint)
    const header = `[PARTIE ${index + 1}/${totalEstimated} DU COURS]\nIMPORTANT : Génère des flashcards UNIQUEMENT pour le contenu de cette partie. Ne duplique pas les notions déjà couvertes dans les parties précédentes. Si une notion a déjà été définie avant, ne la recrée pas — teste un autre angle (exception, condition, exemple).\n\n`

    if (debug) {
      console.log(`%c[DEBUG CHUNKING] Préparation Chunk ${index + 1}/${totalEstimated}`, 'color: #60a5fa')
      console.log(`  - Index départ : ${start}`)
      console.log(`  - Index fin : ${cutPoint}`)
      console.log(`  - Taille contenu : ${chunkContent.length} chars`)
      console.log(`  - Header ajouté (${header.length} chars)`)
    }

    chunks.push(header + chunkContent)

    if (cutPoint >= text.length) break
    start = cutPoint
    index++
  }

  if (debug) console.log('%c[DEBUG CHUNKING] Terminé.', 'color: #c9a84c; font-weight: bold')
  return chunks
}

async function callChunk(
  text: string, 
  type: string, 
  attempt = 0
): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, type })
  })
  if (res.status === 429 && attempt < 3) {
    await new Promise(r => setTimeout(r, 5000 * (attempt + 1)))
    return callChunk(text, type, attempt + 1)
  }
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Erreur serveur')
  }
  const data = await res.json()
  return data.result
}

const AnimatedBook = () => (
  <div className="relative w-24 h-24 mx-auto mb-10 flex items-center justify-center" style={{ perspective: '1200px' }}>
    {/* Base du livre ouvert (Pages de fond) */}
    <div className="absolute w-20 h-16 bg-white/10 rounded-sm border border-white/20 flex shadow-2xl">
      <div className="flex-1 border-r border-white/10" />
      <div className="flex-1" />
    </div>
    
    {/* Pages qui tournent */}
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="absolute w-10 h-16 bg-white border border-gray-300 origin-left shadow-sm"
        initial={{ rotateY: 0 }}
        animate={{ rotateY: -180 }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: i * 0.3,
        }}
        style={{ 
          transformStyle: "preserve-3d",
          backfaceVisibility: "hidden",
          left: "50%",
          borderRadius: "0 2px 2px 0"
        }}
      >
        {/* Lignes de texte factices */}
        <div className="flex flex-col gap-2 p-2 opacity-10">
          <div className="h-1 w-full bg-black rounded-full" />
          <div className="h-1 w-full bg-black rounded-full" />
          <div className="h-1 w-3/4 bg-black rounded-full" />
          <div className="h-1 w-full bg-black rounded-full" />
        </div>
      </motion.div>
    ))}
    
    {/* Reliure centrale (Spine) */}
    <div className="absolute left-1/2 -translate-x-1/2 w-1.5 h-18 bg-accent rounded-full shadow-xl z-20" />
  </div>
)

export default function DocumentUpload() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [tipIndex, setTipIndex] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)
  const supabase = createClient()

  const tips = [
    "🚀 Finie la saisie manuelle : LexJuridica transforme 50 pages de cours en flashcards en 2 minutes.",
    "📜 Le Code Civil de 1804 était surnommé 'La Constitution Civile des Français'.",
    "🧠 Active Recall : Forcez votre cerveau à retrouver l'information plutôt que de simplement la relire.",
    "⚖️ Anti-Hallucination : LexJuridica ne s'appuie que sur VOTRE cours, pas sur des données externes.",
    "🏛️ Saviez-vous ? Jusqu'en 2013, un décret interdisait officiellement aux Parisiennes de porter le pantalon !",
    "⚡ Spaced Repetition (SRS) : Révisez une notion juste avant qu'elle ne sorte de votre mémoire.",
    "📅 Combattez la courbe de l'oubli : LexJuridica espace les rappels de façon mathématique.",
    "🖋️ L'article 1240 du Code Civil (ex-1382) est le fondement de la responsabilité civile : 'Tout fait quelconque de l'homme...'",
    "🔴 Le bouton 'Again' n'est pas un échec, c'est une opportunité de renforcement.",
    "🟠 Le bouton 'Hard' programme une révision sous 6 minutes pour ancrer la notion immédiatement.",
    "📂 Un deck pour chaque matière : organisez votre semestre en quelques clics.",
    "📜 Respect strict du texte : Les définitions sont celles de vos professeurs.",
    "🔍 Focus sur le régime : L'IA extrait prioritairement le 'qui, quand, comment' des règles.",
    "🏗️ L'IA structure vos révisions : elle identifie d'elle-même les plans et sous-parties.",
    "🦁 Le terme 'avocat' vient du latin 'advocatus' (celui qui est appelé pour assister).",
    "💤 Récupérez des heures de sommeil en automatisant vos fiches de TD.",
    "🚉 Optimisez vos trajets : exportez vos decks en PDF pour réviser sans écran.",
    "⚖️ En droit français, le silence de l'administration vaut acceptation après 2 mois (avec exceptions !).",
    "💎 La brièveté des réponses force la clarté mentale et la précision juridique.",
    "🛡️ Pas d'invention : Si votre cours est flou, l'IA préfère ne pas créer de carte erronée.",
    "🏛️ Jurisprudence : Les arrêts clés sont isolés pour une mémorisation rapide.",
    "🎮 L'XP et les niveaux transforment l'effort en jeu : restez motivé sur la durée.",
    "📈 Visualisez votre progression : chaque carte révisée augmente votre Mastery.",
    "🥖 Jusqu'en 2014, les boulangers parisiens ne pouvaient pas tous partir en vacances en même temps (loi de 1790).",
    "🔓 Mode Libre : Pour réviser même quand l'algorithme juge que vous êtes 'à jour'.",
    "🎨 Interface sans distraction : Un design épuré pour une concentration maximale.",
    "🌍 Accessibilité : Vos révisions vous suivent partout sur votre compte LexJuridica.",
    "⚖️ La 'Loi Toubon' de 1994 oblige l'usage du français dans la publicité et l'espace public.",
    "📑 Export PDF stylisé : Des fiches élégantes à imprimer pour les adeptes du papier.",
    "⏱️ Le chronomètre de révision vous aide à planifier vos pauses intelligemment.",
    "💡 Tip : Relire une fiche 10 minutes avant de dormir booste la mémorisation nocturne.",
    "⚖️ Le principe 'Nul n'est censé ignorer la loi' signifie qu'on ne peut pas invoquer son ignorance pour échapper à une règle.",
    "🤖 Tuteur Socratique : Notre IA vous force à réfléchir comme un futur avocat.",
    "🎓 Conseil : Expliquez un concept complexe à un ami. Si c'est clair, c'est mémorisé.",
    "🔒 Sécurité : Vos documents sont cryptés et traités par une IA juridique spécialisée.",
    "⚖️ La présomption d'innocence est un principe cardinal : on est innocent tant que la culpabilité n'est pas prouvée.",
    "🐚 Ancien monde : Fiches papier = 20h de travail. LexJuridica = 2 min d'analyse IA.",
    "📏 Conditions Cumulatives : L'IA liste proprement les critères nécessaires à une règle.",
    "⚖️ Distinction Principe/Exception : Les flashcards mettent en lumière les nuances du droit.",
    "🏛️ La dernière exécution par guillotine en France a eu lieu en 1977 (soit après la sortie de Star Wars !).",
    "🔗 Relier une question à une réponse courte crée des connexions neuronales fortes.",
    "🎯 Visez le niveau 10 avant vos premiers examens blancs.",
    "🔋 Vérifiez toujours vos quotas d'énergie IA en haut à droite.",
    "⚖️ Le droit de propriété est qualifié d'absolu, d'exclusif et de perpétuel.",
    "🔎 Utilisez la recherche dans les fiches pour retrouver une règle en un clin d'œil.",
    "🗑️ Supprimez les vieux decks pour ne garder que l'essentiel de votre semestre.",
    "🤝 Partagez vos PDF exportés avec vos camarades pour réviser en groupe.",
    "⚖️ Un contrat est une loi pour les parties qui l'ont fait (force obligatoire du contrat).",
    "✅ Faites confiance à l'algorithme : s'il dit 'à jour', passez à une autre matière.",
    "👔 Précision du vocabulaire : Le jargon juridique est préservé pour vos examens.",
    "⚖️ Le mariage posthume est possible en France (sur autorisation du Président de la République).",
    "📅 Spaced Repetition : Plus vous réussissez une carte, plus elle revient tard.",
    "🧠 Effort mental = Mémorisation. Plus c'est dur de s'en souvenir, mieux ça s'ancre.",
    "🏛️ La Constitution de 1958 est le texte fondateur de la Ve République.",
    "⚖️ Le principe de non-rétroactivité : La loi ne dispose que pour l'avenir, elle n'a pas d'effet rétroactif.",
    "🖋️ Le saviez-vous ? Napoléon considérait le Code Civil comme son plus grand chef-d'œuvre.",
    "⚖️ La hiérarchie des normes : La Constitution est toujours au-dessus de la Loi.",
    "📝 Prenez l'habitude de réviser vos 'Nouveaux' dès le matin.",
    "🚀 LexJuridica identifie les 'Conditions de fond' et 'Conditions de forme' automatiquement.",
    "📚 Un cours bien structuré donne des flashcards de meilleure qualité.",
    "💡 Astuce : Utilisez le mode Libre pour un 'blitz' de révision avant un oral.",
    "⚖️ L'infans est l'enfant qui n'a pas encore la parole (et donc pas encore de discernement en droit).",
    "🛡️ Vos documents sont automatiquement supprimés après analyse si vous le souhaitez.",
    "⚖️ Le droit n'est pas une science exacte, mais LexJuridica rend sa structure logique.",
    "🔥 Constance > Intensité. 15 min par jour valent mieux que 5h une fois par mois."
  ]

  useEffect(() => {
    let interval: any
    if (loading) {
      interval = setInterval(() => {
        setTipIndex((prev) => (prev + 1) % tips.length)
      }, 5000)
    }
    return () => clearInterval(interval)
  }, [loading])

  const extractText = async (file: File): Promise<string> => {
    if (file.type === 'application/pdf') {
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
      let text = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map((item: any) => (item as any).str).join(' ') + '\n'
      }
      return text
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      return result.value
    }
    return ''
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setStatus('Extraction du texte...')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const rawText = await extractText(file)
      if (!rawText) throw new Error("Impossible d'extraire le texte")

      const isAdmin = user.email && ADMIN_EMAILS.includes(user.email)
      const chunks = splitIntoChunks(rawText, !!isAdmin)
      const totalChunks = chunks.length

      // ── SUMMARY ──────────────────────────────────────────
      setStatus(`Génération de la fiche (0/${totalChunks})...`)
      const summaryParts: string[] = []

      for (let i = 0; i < chunks.length; i++) {
        setStatus(`Fiche : partie ${i + 1}/${totalChunks}...`)
        const partialSummary = await callChunk(chunks[i], 'summary')
        summaryParts.push(partialSummary)

        await supabase.from('documents').upsert({
          user_id: user.id,
          title: file.name,
          content_raw: rawText.substring(0, 10000),
          summary_html: summaryParts.join(''),
          size: file.size,
          type: file.type,
          status: 'processing'
        }, { onConflict: 'user_id,title' })

        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 2000))
        }
      }

      let fullSummaryHtml: string
      if (summaryParts.length === 1) {
        fullSummaryHtml = summaryParts[0]
      } else {
        setStatus('Finalisation de la fiche...')
        const mergeText = summaryParts
          .map((p, i) => `=== RÉSUMÉ PARTIE ${i + 1} ===\n${p}`)
          .join('\n\n')
          .slice(0, 20000)
        fullSummaryHtml = await callChunk(mergeText, 'summary')
      }

      // ── SAVE FINAL DOCUMENT ──────────────────────────────
      const { data: doc, error: docErr } = await supabase
        .from('documents')
        .upsert({
          user_id: user.id,
          title: file.name,
          content_raw: rawText.substring(0, 10000),
          summary_html: fullSummaryHtml,
          size: file.size,
          type: file.type,
          status: 'done'
        }, { onConflict: 'user_id,title' })
        .select()
        .single()

      if (docErr) throw new Error('Erreur enregistrement document')

      // ── FLASHCARDS ───────────────────────────────────────
      setStatus(`Flashcards : partie 0/${totalChunks}...`)
      const allCards: Array<{ q: string, a: string }> = []

      for (let i = 0; i < chunks.length; i++) {
        setStatus(`Flashcards : partie ${i + 1}/${totalChunks}...`)
        try {
          const raw = await callChunk(chunks[i], 'flashcards')
          const firstBracket = raw.indexOf('[')
          const lastBracket = raw.lastIndexOf(']')
          if (firstBracket !== -1 && lastBracket !== -1) {
            const parsed = JSON.parse(raw.substring(firstBracket, lastBracket + 1))
            if (Array.isArray(parsed)) {
              allCards.push(...parsed.filter((c: any) => 
                (c.q || c.question) && (c.a || c.answer || c.reponse)
              ))
            }
          }
        } catch (e) {
          console.warn(`Chunk ${i + 1} flashcards failed, skipping:`, e)
        }

        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 2000))
        }
      }

      const seen = new Set<string>()
      const dedupedCards = allCards.filter((c: any) => {
        const key = (c.q || c.question || '').toLowerCase().trim()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      // ── SAVE DECK AND CARDS ──────────────────────────────
      const { data: deck, error: deckErr } = await supabase.from('decks').insert({
        user_id: user.id,
        document_id: doc.id,
        title: file.name
      }).select().single()

      if (deckErr) throw new Error(`Erreur Deck: ${deckErr.message}`)

      if (deck && dedupedCards.length > 0) {
        const srsCards = dedupedCards.map((f: any) => ({
          user_id: user.id,
          deck_id: deck.id,
          front: f.q || f.question,
          back: f.a || f.answer || f.reponse
        }))
        const { error: srsErr } = await supabase.from('user_srs').insert(srsCards)
        if (srsErr) console.error("Erreur insertion cartes SRS:", srsErr)
      }

      setStatus('Terminé !')
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#c9a84c', '#ffffff']
      })
      setShowSuccess(true)
      setTimeout(() => {
        setStatus('')
        setShowSuccess(false)
        window.location.reload()
      }, 3000)
    } catch (err: any) {
      alert("Erreur : " + err.message)
      setStatus('Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div 
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              className="glass-card p-12 border-accent shadow-[0_0_50px_rgba(201,168,76,0.3)]"
            >
              <div className="w-24 h-24 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <PartyPopper size={48} className="text-accent" />
              </div>
              <h2 className="text-4xl font-black mb-4 uppercase tracking-tighter">Félicitations !</h2>
              <p className="text-xl text-gray-300 mb-2">Votre cours a été analysé avec succès.</p>
              <p className="text-accent font-bold">Fiches et Flashcards prêtes ! 🚀</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="glass-card p-12 max-w-md border-accent/50 animate-in fade-in zoom-in duration-300">
            <AnimatedBook />
            <h2 className="text-2xl font-black mb-2 text-white uppercase tracking-tighter">Analyse en cours</h2>
            <p className="text-accent font-bold animate-pulse mb-8">{status}</p>
            
            <div className="relative h-24 flex items-center justify-center overflow-hidden bg-white/5 rounded-2xl p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tipIndex}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-sm text-gray-300 italic leading-relaxed"
                >
                  {tips[tipIndex]}
                </motion.div>
              </AnimatePresence>
            </div>
            
            <p className="mt-6 text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              Traitement juridique sécurisé
            </p>
          </div>
        </div>
      )}

      <div className="glass-card p-12 text-center border-dashed border-2 border-white/10 hover:border-accent/50 transition-all group">
        <input 
          type="file" 
          id="file-upload" 
          className="hidden" 
          accept=".pdf,.docx"
          onChange={handleUpload}
          disabled={loading}
        />
        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
          <Upload size={48} className="text-gray-500 group-hover:text-accent mb-4 transition-colors" />
          <h3 className="text-xl font-bold mb-2">
            Cliquez pour uploader un cours
          </h3>
          <p className="text-gray-400 mb-6">PDF ou DOCX (max 200 pages)</p>
          
          {status && !loading && (
            <div className="flex items-center gap-2 text-accent font-medium animate-pulse">
              <CheckCircle2 size={16} />
              <span>{status}</span>
            </div>
          )}
        </label>
      </div>
    </>
  )
}
