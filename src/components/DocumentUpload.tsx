'use client'
import { useState, useEffect, useRef } from 'react'
import { Upload, CheckCircle2, Loader2, PartyPopper, Scale, ShieldAlert, BookOpen, Lightbulb, AlertTriangle, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import mammoth from 'mammoth'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { updateGamification } from '@/lib/gamification'

// CONFIGURATION
const CHUNK_SIZE = 12000
const SECURE_DELAY = 4500

const LEGAL_FACTS = [
  "Le saviez-vous ? Le Code civil de 1804 contenait 2281 articles originaux.",
  "Conseil : La structure de votre fiche respecte toujours le plan I. II. III.",
  "En droit, 'Nul n'est censé ignororer la loi' est une fiction juridique indispensable.",
  "Le Pass 2 de l'IA audite vos flashcards pour ne rater aucun arrêt de cassation.",
  "Astuce : Révisez vos flashcards le soir avant de dormir pour une meilleure rétention.",
  "Le Conseil constitutionnel a été créé en 1958, sous la Ve République.",
  "La répétition espacée (SRS) réduit votre temps de révision de 50%."
]

// ── COMPOSANTS INTERNES ──────────────────────────────────────────

const LegalScanner = () => (
  <div className="relative w-48 h-32 mx-auto mb-8 overflow-hidden bg-black/40 border border-white/10 rounded-lg">
    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 opacity-20">
      <div className="w-32 h-2 bg-white/20 rounded-full" />
      <div className="w-24 h-2 bg-white/20 rounded-full" />
      <div className="w-28 h-2 bg-white/20 rounded-full" />
    </div>
    <motion.div 
      className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent shadow-[0_0_15px_rgba(201,168,76,0.8)] z-10"
      animate={{ top: ['0%', '100%', '0%'] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
    />
    <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
    <Scale size={40} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent/30" />
  </div>
)

const FactRotator = () => {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setIdx(prev => (prev + 1) % LEGAL_FACTS.length), 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        key={idx}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex items-start gap-3 text-left p-4 bg-white/5 rounded-xl border border-white/5 mt-6 min-h-[80px]"
      >
        <Lightbulb className="text-accent shrink-0 mt-0.5" size={18} />
        <p className="text-xs text-gray-400 leading-relaxed italic">{LEGAL_FACTS[idx]}</p>
      </motion.div>
    </AnimatePresence>
  )
}

function parseFlashcards(raw: string): any[] {
  if (!raw) return []
  const cleaned = raw.trim()
  try { return JSON.parse(cleaned) } catch (e) {}
  const start = cleaned.indexOf('[')
  if (start === -1) return []
  let end = cleaned.lastIndexOf(']')
  while (end > start) {
    try {
      const potential = cleaned.substring(start, end + 1)
      return JSON.parse(potential)
    } catch (e) {
      end = cleaned.lastIndexOf(']', end - 1)
    }
  }
  return []
}

function cleanExtractedText(text: string): string {
  if (!text) return ''
  return text
    .replace(/!\'|! \'/g, '→')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function findBestCutPoint(text: string, targetEnd: number): number {
  const searchStart = Math.max(0, targetEnd - 5000)
  const searchZone = text.slice(searchStart, targetEnd)
  const doubleNewline = searchZone.lastIndexOf('\n\n')
  if (doubleNewline !== -1) return searchStart + doubleNewline
  const lastSpace = searchZone.lastIndexOf(' ')
  if (lastSpace !== -1) return searchStart + lastSpace
  return targetEnd
}

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const rawEnd = Math.min(start + CHUNK_SIZE, text.length)
    const cutPoint = rawEnd === text.length ? rawEnd : findBestCutPoint(text, rawEnd)
    chunks.push(text.slice(start, cutPoint))
    start = cutPoint
  }
  return chunks
}

async function callIA(text: string, type: string, context?: string): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, type, context })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Erreur IA')
  }
  const data = await res.json()
  return data.result
}

// ── COMPOSANT PRINCIPAL ──────────────────────────────────────────

export default function DocumentUpload() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const isCancelled = useRef(false)
  const supabase = createClient()

  const handleCancel = () => {
    isCancelled.current = true
    setLoading(false)
    setStatus('Annulation en cours...')
    window.location.reload() // Solution radicale mais sûre pour stopper tous les timeouts
  }

  const extractText = async (file: File): Promise<string> => {
    let rawText = ''

    const getBuffer = async (f: File): Promise<ArrayBuffer> => {
      if (f.arrayBuffer) return await f.arrayBuffer()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.onerror = reject
        reader.readAsArrayBuffer(f)
      })
    }

    if (file.type === 'application/pdf') {
      setStatus('Chargement du moteur PDF...')
      const pdfjsLib = await import('pdfjs-dist')
      // Utilisation du build legacy pour une compatibilité maximale sur mobile
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.mjs`
      
      setStatus('Lecture du fichier...')
      const arrayBuffer = await getBuffer(file)
      
      setStatus('Décodage du PDF...')
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, stopAtErrors: true }).promise
      const total = pdf.numPages
      
      for (let i = 1; i <= total; i++) {
        if (isCancelled.current) throw new Error('CANCELED')
        setStatus(`Lecture page ${i}/${total}...`)
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const items = content.items || []
        rawText += items.map((item: any) => item.str || '').join(' ') + "\n\n"
      }
    } else {
      setStatus('Chargement du moteur Word...')
      const mammoth = await import('mammoth')
      setStatus('Lecture du fichier...')
      const arrayBuffer = await getBuffer(file)
      const result = await mammoth.extractRawText({ arrayBuffer })
      rawText = result.value
    }
    setStatus('Nettoyage du texte...')
    return cleanExtractedText(rawText)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setStatus('Préparation du document...')
    isCancelled.current = false

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      
      const cleanedText = await extractText(file)
      if (isCancelled.current) return

      const chunks = splitIntoChunks(cleanedText)
      const totalChunks = chunks.length

      // ── CHECK ÉNERGIE PRÉDICTIF ────────────────────────
      const estimatedCost = 1 + (totalChunks * 2)
      const { data: stats } = await supabase.from('user_stats').select('ai_energy').eq('id', user.id).single()
      if ((stats?.ai_energy || 0) < estimatedCost) {
        throw new Error(`Énergie insuffisante (${stats?.ai_energy || 0}/${estimatedCost} requis).`)
      }

      // ── RÉSUMÉ (FLUX HYBRIDE GEMINI -> MISTRAL) ─────────
      setStatus('Extraction des données juridiques...')
      const summaryExtracts: string[] = []
      for (let i = 0; i < chunks.length; i++) {
        if (isCancelled.current) return
        setStatus(`Extraction : bloc ${i + 1}/${totalChunks}...`)
        const extract = await callIA(chunks[i], 'summary_extract')
        summaryExtracts.push(`--- BLOC ${i+1} ---\n${extract}`)
        if (i < totalChunks - 1) await new Promise(r => setTimeout(r, SECURE_DELAY))
      }

      if (isCancelled.current) return
      setStatus('Assemblage de la fiche...')
      const fullSummaryHtml = summaryExtracts
        .join('\n\n')
        .replace(/--- BLOC \d+ ---\n/g, '')

      if (isCancelled.current) return
      const { data: doc } = await supabase.from('documents').upsert({
        user_id: user.id, title: file.name, content_raw: cleanedText,
        summary_html: fullSummaryHtml, size: file.size, type: file.type, status: 'done'
      }, { onConflict: 'user_id,title' }).select().single()

      // ── FLASHCARDS (PASS 1 + PASS 2) - INCHANGÉ ─────────
      setStatus('Génération des flashcards...')
      const allCards: any[] = []
      for (let i = 0; i < chunks.length; i++) {
        if (isCancelled.current) return
        setStatus(`Flashcards Pass 1 : bloc ${i + 1}/${totalChunks}...`)
        const rawPass1 = await callIA(chunks[i], 'flashcards')
        const cardsPass1 = parseFlashcards(rawPass1)
        allCards.push(...cardsPass1)

        await new Promise(r => setTimeout(r, SECURE_DELAY))

        if (isCancelled.current) return
        setStatus(`Flashcards Pass 2 : bloc ${i + 1}/${totalChunks}...`)
        const questionsPass1 = cardsPass1.slice(0, 40).map(c => c.q).join(' | ')
        const pass2Input = `COURS:\n${chunks[i].substring(0, 10000)}\n\nQUESTIONS DÉJÀ EXISTANTES:\n${questionsPass1}`
        const rawPass2 = await callIA(pass2Input, 'flashcards_pass2')
        const cardsPass2 = parseFlashcards(rawPass2)
        allCards.push(...cardsPass2)

        if (i < chunks.length - 1) await new Promise(r => setTimeout(r, SECURE_DELAY))
      }

      if (isCancelled.current) return
      const seen = new Set<string>()
      const dedupedCards = allCards.filter(c => {
        const q = (c.q || c.question || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60)
        if (!q || seen.has(q)) return false
        seen.add(q)
        return true
      })

      const { data: deck } = await supabase.from('decks').insert({ user_id: user.id, document_id: doc?.id, title: file.name }).select().single()
      if (deck && dedupedCards.length > 0) {
        await supabase.from('user_srs').insert(dedupedCards.map(f => ({
          user_id: user.id, deck_id: deck.id, front: f.q || f.question, back: f.a || f.answer || f.reponse
        })))
      }

      if (isCancelled.current) return
      await updateGamification(user.id, 'upload')
      setStatus('Terminé !')
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#c9a84c', '#ffffff', '#000000'] })
      setShowSuccess(true)
      setTimeout(() => window.location.reload(), 2000)
    } catch (err: any) {
      if (err.message === 'CANCELED') return
      alert(err.message)
      setLoading(false)
    }
  }

  return (
    <>
      <AnimatePresence>
        {showSuccess && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-center p-6 text-center">
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="glass-card p-12 border-accent shadow-[0_0_50px_rgba(201,168,76,0.3)]">
              <PartyPopper size={48} className="text-accent mx-auto mb-6" />
              <h2 className="text-4xl font-black mb-4 uppercase tracking-tighter text-white">Cours Analysé !</h2>
              <p className="text-accent font-bold italic">Votre deck de flashcards est prêt ⚖️</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="glass-card p-12 max-w-md border-accent/50 animate-in zoom-in duration-300 shadow-[0_0_40px_rgba(201,168,76,0.1)]">
            <LegalScanner />
            <h2 className="text-2xl font-black mb-1 text-white uppercase tracking-tighter">Analyse en cours</h2>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Loader2 className="animate-spin text-accent" size={16} />
              <p className="text-accent font-bold text-sm">{status}</p>
            </div>
            
            <FactRotator />

            <button 
              onClick={handleCancel}
              className="mt-8 flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-all mx-auto border border-red-500/20"
            >
              <XCircle size={14} /> Annuler l'analyse
            </button>

            <p className="text-[10px] text-gray-500 italic mt-6 flex items-center justify-center gap-1">
              <ShieldAlert size={10} /> Analyse hybride — fidélité maximale garantie.
            </p>
          </div>
        </div>
      )}

      <div className="glass-card p-12 text-center border-dashed border-2 border-white/10 hover:border-accent/50 transition-all group relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity"><Scale size={80} /></div>
        <input type="file" id="file-upload" className="hidden" accept=".pdf,.docx" onChange={handleUpload} disabled={loading} />
        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center relative z-10">
          <div className="p-5 bg-white/5 rounded-full mb-6 group-hover:bg-accent/10 transition-colors">
            <Upload size={48} className="text-gray-500 group-hover:text-accent transition-colors" />
          </div>
          <h3 className="text-2xl font-extrabold mb-2 text-white uppercase tracking-tight">Transformer un cours</h3>
          <p className="text-gray-400 mb-6 text-sm max-w-xs mx-auto">Extraction par Gemini, rédaction par Mistral Large.</p>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full text-[10px] text-gray-400"><BookOpen size={12} className="text-accent" /> Fiche Hybride</div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full text-[10px] text-gray-400"><CheckCircle2 size={12} className="text-accent" /> Zéro Hallucination</div>
          </div>
          <span className="btn-premium group-hover:scale-105 transition-transform">Sélectionner un fichier</span>
          <p className="mt-6 text-[10px] text-gray-500 italic flex items-center gap-1 justify-center"><AlertTriangle size={10} className="text-accent" /> Format supportés : PDF, DOCX (max 15Mo)</p>
        </label>
      </div>
    </>
  )
}
