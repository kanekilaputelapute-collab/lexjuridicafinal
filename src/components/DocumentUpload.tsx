'use client'
import { useState, useEffect } from 'react'
import { Upload, CheckCircle2, Loader2, PartyPopper, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import mammoth from 'mammoth'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

// Seuils calibrés pour Mistral Large (128K tokens context, 4096 tokens output)
const SINGLE_CALL_LIMIT = 30000
const CHUNK_SIZE = 20000

const ADMIN_EMAILS = ['teampush5@gmail.com']

function cleanExtractedText(text: string): string {
  if (!text) return ''
  return text
    // 1. Remplace !' et variantes par →
    .replace(/!\'|! \'/g, '→')
    // 2. Supprime les caractères de contrôle non imprimables
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // 3. Répare les mots coupés avec tiret en fin de ligne : "mot-\nsuite" → "motsuite"
    .replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2')
    // 4. Normalise les espaces multiples en espace simple
    .replace(/[ \t]+/g, ' ')
    // 5. Réduit les sauts de ligne triples ou plus en double saut de ligne
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function findBestCutPoint(text: string, targetEnd: number): number {
  const searchStart = Math.max(0, targetEnd - 5000)
  const searchZone = text.slice(searchStart, targetEnd)

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

  const doubleNewline = searchZone.lastIndexOf('\n\n')
  if (doubleNewline !== -1) {
    return searchStart + doubleNewline
  }

  const sentenceEnd = searchZone.lastIndexOf('.\n')
  if (sentenceEnd !== -1) {
    return searchStart + sentenceEnd + 1
  }

  const lastSpace = searchZone.lastIndexOf(' ')
  if (lastSpace !== -1) {
    return searchStart + lastSpace
  }

  return targetEnd
}

function splitIntoChunks(text: string, debug = false): string[] {
  if (debug) console.log(`%c[DEBUG CHUNKING] Taille totale du texte : ${text.length} caractères`, 'color: #c9a84c; font-weight: bold')
  
  if (text.length <= SINGLE_CALL_LIMIT) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0
  let index = 0
  const totalEstimated = Math.ceil(text.length / CHUNK_SIZE)

  while (start < text.length) {
    const rawEnd = Math.min(start + CHUNK_SIZE, text.length)
    const cutPoint = rawEnd === text.length ? rawEnd : findBestCutPoint(text, rawEnd)

    const chunkContent = text.slice(start, cutPoint)
    const header = `[PARTIE ${index + 1}/${totalEstimated} DU COURS]
RÈGLES CRITIQUES POUR CETTE PARTIE :
1. COUVERTURE TOTALE : Tu dois impérativement couvrir CHAQUE titre de section, chapitre ou sous-partie visible dans ce texte.
2. DENSITÉ : Produis au moins 1 flashcard par section ou notion identifiée. Ne saute aucun paragraphe informatif.
3. PAS DE DOUBLONS : Ne duplique pas les notions déjà couvertes dans les parties précédentes. Si une notion a déjà été définie avant, teste un autre angle (exception, condition, exemple).
4. FOCUS : Concentre-toi exclusivement sur les informations présentes dans ce chunk précis.\n\n`

    chunks.push(header + chunkContent)

    if (cutPoint >= text.length) break
    start = cutPoint
    index++
  }

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
    <div className="absolute w-20 h-16 bg-white/10 rounded-sm border border-white/20 flex shadow-2xl">
      <div className="flex-1 border-r border-white/10" />
      <div className="flex-1" />
    </div>
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
        <div className="flex flex-col gap-2 p-2 opacity-10">
          <div className="h-1 w-full bg-black rounded-full" />
          <div className="h-1 w-full bg-black rounded-full" />
          <div className="h-1 w-3/4 bg-black rounded-full" />
          <div className="h-1 w-full bg-black rounded-full" />
        </div>
      </motion.div>
    ))}
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
    "🔍 Focus sur le régime : L'IA extrait prioritairement le 'qui, quand, comment' des règles.",
    "🦁 Le terme 'avocat' vient du latin 'advocatus' (celui qui est appelé pour assister).",
    "💤 Récupérez des heures de sommeil en automatisant vos fiches de TD.",
    "⚖️ En droit français, le silence de l'administration vaut acceptation après 2 mois (avec exceptions !).",
    "💎 La brièveté des réponses force la clarté mentale et la précision juridique.",
    "🛡️ Pas d'invention : Si votre cours est flou, l'IA préfère ne pas créer de carte erronée.",
    "🏛️ Jurisprudence : Les arrêts clés sont isolés pour une mémorisation rapide.",
    "🎮 L'XP et les niveaux transforment l'effort en jeu : restez motivé sur la durée.",
    "📈 Visualisez votre progression : chaque carte révisée augmente votre Mastery.",
    "⚖️ Le principe 'Nul n'est censé ignorer la loi' signifie qu'on ne peut pas invoquer son ignorance pour échapper à une règle.",
    "🤖 Tuteur Socratique : Notre IA vous force à réfléchir comme un futur avocat.",
    "🎓 Conseil : Expliquez un concept complexe à un ami. Si c'est clair, c'est mémorisé.",
    "🔒 Sécurité : Vos documents sont cryptés et traités par une IA juridique spécialisée.",
    "⚖️ La présomption d'innocence est un principe cardinal : on est innocent tant que la culpabilité n'est pas prouvée.",
    "📏 Conditions Cumulatives : L'IA liste proprement les critères nécessaires à une règle.",
    "⚖️ Distinction Principe/Exception : Les flashcards mettent en lumière les nuances du droit.",
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

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const pdfjsLib = await import('pdfjs-dist')
      
      // Configuration forcée du worker sur UNPKG avec extension .mjs
      const workerUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
      
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        stopAtErrors: true 
      })
      
      const pdf = await loadingTask.promise
      let fullText = ""
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
        fullText += pageText + "\n\n"
      }
      return fullText
    } catch (error) {
      console.error("Erreur complète extraction PDF:", error)
      throw new Error("Impossible de charger le moteur d'analyse PDF. Vérifiez votre connexion internet.")
    }
  }

  const extractText = async (file: File): Promise<string> => {
    let rawText = ''
    if (file.type === 'application/pdf') {
      rawText = await extractTextFromPDF(file)
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      rawText = result.value
    }
    
    return cleanExtractedText(rawText)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setStatus('Extraction du texte...')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const cleanedText = await extractText(file)
      if (!cleanedText) throw new Error("Impossible d'extraire le texte")

      const isAdmin = user.email && ADMIN_EMAILS.includes(user.email)
      const chunks = splitIntoChunks(cleanedText, !!isAdmin)
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
          content_raw: cleanedText.substring(0, 10000),
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

      const { data: doc, error: docErr } = await supabase
        .from('documents')
        .upsert({
          user_id: user.id,
          title: file.name,
          content_raw: cleanedText.substring(0, 10000),
          summary_html: fullSummaryHtml,
          size: file.size,
          type: file.type,
          status: 'done'
        }, { onConflict: 'user_id,title' })
        .select()
        .single()

      if (docErr) throw new Error('Erreur enregistrement document')

      // ── FLASHCARDS ───────────────────────────────────────
      // Sélection automatique du mode selon la taille du doc
      const USE_3_PASS = chunks.length <= 8   // < ~80 000 chars
      const USE_2_PASS = chunks.length <= 15  // < ~150 000 chars
      // Au-delà : 1 pass amélioré

      console.log(`%c[MODE] ${chunks.length} chunks → ${USE_3_PASS ? '3 passes' : USE_2_PASS ? '2 passes' : '1 pass amélioré'}`, 'color: #c9a84c; font-weight: bold')

      let verifiedMappings: string[] = []

      if (USE_3_PASS || USE_2_PASS) {
        // ── PASS 1 : Cartographie ──────────────────────────────
        setStatus('Pass 1 : cartographie du cours...')
        const mappings: string[] = []
        for (let i = 0; i < chunks.length; i++) {
          setStatus(`Pass 1 : chunk ${i + 1}/${chunks.length}...`)
          try {
            const mapping = await callChunk('[PASS1]\n\n' + chunks[i], 'flashcards')
            mappings.push(mapping)
          } catch (e) {
            console.warn(`Pass 1 chunk ${i + 1} échoué, ignoré`)
            mappings.push('')
          }
          if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 1200))
        }

        if (USE_3_PASS) {
          // ── PASS 2 : Vérification (seulement si <= 8 chunks) ──
          setStatus('Pass 2 : vérification de la cartographie...')
          for (let i = 0; i < chunks.length; i++) {
            setStatus(`Pass 2 : chunk ${i + 1}/${chunks.length}...`)
            try {
              const pass2Prompt = `[PASS2]\n\nCARTOGRAPHIE PASS 1 :\n${mappings[i]}\n\nTEXTE SOURCE :\n${chunks[i]}`
              const verified = await callChunk(pass2Prompt, 'flashcards')
              verifiedMappings.push(verified)
            } catch (e) {
              console.warn(`Pass 2 chunk ${i + 1} échoué, fallback sur mapping pass 1`)
              verifiedMappings.push(mappings[i])
            }
            if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 1200))
          }
        } else {
          // 2 passes : on utilise directement la cartographie du Pass 1
          verifiedMappings = mappings
        }
      }

      // ── PASS FINAL : Génération des flashcards ─────────────
      const BATCH_SIZE = 2
      const allCards: Array<{ q: string, a: string }> = []
      const totalBatches = Math.ceil(chunks.length / BATCH_SIZE)

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1
        setStatus(`Flashcards : batch ${batchIndex}/${totalBatches}...`)

        const batchPromises = []
        for (let j = i; j < Math.min(i + BATCH_SIZE, chunks.length); j++) {
          let prompt: string
          if (USE_3_PASS || USE_2_PASS) {
            prompt = `[PASS3]\n\nCARTOGRAPHIE VÉRIFIÉE :\n${verifiedMappings[j]}\n\nTEXTE SOURCE :\n${chunks[j]}`
          } else {
            // 1 pass amélioré : chain-of-thought implicite
            prompt = chunks[j]
          }
          batchPromises.push(callChunk(prompt, 'flashcards'))
        }

        const results = await Promise.allSettled(batchPromises)

        for (const result of results) {
          if (result.status === 'rejected') {
            console.warn('Chunk échoué, ignoré:', result.reason)
            continue
          }
          try {
            const raw = result.value
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
            console.warn('Parse JSON échoué:', e)
          }
        }

        if (i + BATCH_SIZE < chunks.length) {
          await new Promise(r => setTimeout(r, 2500))
        }
      }

      // Déduplication améliorée
      const seen = new Set<string>()
      const dedupedCards = allCards.filter((c: any) => {
        const question = (c.q || c.question || '')
        const normalized = question.toLowerCase().replace(/[^a-z0-9àéèêëîïôùûü]/g, '')
        const key80 = normalized.substring(0, 80)
        const keyMid = normalized.length > 50 ? normalized.substring(10, 50) : ''
        if (!key80 || seen.has(key80)) return false
        if (keyMid && [...seen].some(k => k.includes(keyMid))) return false
        seen.add(key80)
        return true
      })

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

function TrophyIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 4H6v7a6 6 0 0 0 12 0V4Z" />
    </svg>
  )
}
