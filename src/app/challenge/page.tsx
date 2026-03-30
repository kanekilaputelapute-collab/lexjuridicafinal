'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import UserStatusBar from '@/components/UserStatusBar'
import { Zap, Send, Loader2, Trophy, Clock, ChevronRight, AlertCircle, CheckCircle2, GraduationCap } from 'lucide-react'
import confetti from 'canvas-confetti'

export default function ChallengePage() {
  const [documents, setDocuments] = useState<any[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [scenario, setScenario] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<{ score: number, feedback: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchingDocs, setFetchingDocs] = useState(true)
  const [timeLeft, setTimeLeft] = useState(180)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchUserDocuments()
  }, [])

  async function fetchUserDocuments() {
    setFetchingDocs(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return window.location.href = '/'

    const { data } = await supabase
      .from('documents')
      .select('id, title, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setDocuments(data || [])
    setFetchingDocs(false)
  }

  useEffect(() => {
    let timer: any
    if (isActive && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
    } else if (timeLeft === 0 && isActive) {
      submitAnswer()
    }
    return () => clearInterval(timer)
  }, [isActive, timeLeft])

  async function startNewChallenge(docId: string) {
    setLoading(true)
    setError(null)
    setResult(null)
    setAnswer('')
    setTimeLeft(180)
    setSelectedDocId(docId)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get context from the SPECIFIC selected document
      const { data: doc } = await supabase
        .from('documents')
        .select('summary_html')
        .eq('id', docId)
        .single()

      if (!doc) throw new Error("Document introuvable.")

      const fullText = doc.summary_html.replace(/<[^>]*>/g, '')
      const totalChars = fullText.length
      const chunkSize = 15000

      const THEME_KEYWORDS: Record<number, string[]> = {
        0: ['parents', 'autorité parentale', 'cohabitation', '1242'],
        1: ['commettant', 'préposé', 'abus de fonctions'],
        2: ['Blieck', 'principe général', 'mode de vie'],
        3: ['garde', 'transfert', 'chose inerte'],
        4: ['structure', 'comportement', 'oxygène'],
        5: ['perte de chance', 'certain', 'légitime'],
        6: ['Dintilhac', 'déficit fonctionnel', 'souffrances endurées'],
        7: ['gestion d\'affaires', 'paiement de l\'indu', 'quasi-contrat'],
        8: ['enrichissement injustifié', 'subsidiarité', 'Boudier'],
        9: ['Badinter', 'VTAM', 'implication'],
        10: ['produits défectueux', 'défaut', 'mise en circulation'],
        11: ['voisinage', 'trouble anormal', 'préoccupation'],
        12: ['force majeure', 'in solidum', 'irrésistible'],
        13: ['abstention', 'faits justificatifs', 'acceptation des risques'],
        14: ['anxiété', 'pretium doloris', 'Dintilhac'],
      }

      const themeIndex = Math.floor(Math.random() * 15)
      const keywords = THEME_KEYWORDS[themeIndex] || []

      let startPos = 0
      for (const kw of keywords) {
        const idx = fullText.toLowerCase().indexOf(kw.toLowerCase())
        if (idx !== -1) {
          startPos = Math.max(0, idx - 2000)
          break
        }
      }
      if (startPos === 0 && totalChars > chunkSize) {
        startPos = Math.floor(Math.random() * (totalChars - chunkSize))
      }

      const cleanText = fullText.substring(startPos, Math.min(startPos + chunkSize, totalChars))

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: cleanText, 
          type: 'challenge_gen',
          themeIndex: themeIndex
        })
      })

      const data = await res.json()
      if (data.result) {
        setScenario(data.result)
        setIsActive(true)
      } else {
        throw new Error("L'IA n'a pas pu générer de cas.")
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitAnswer() {
    setIsActive(false)
    setLoading(true)

    // SÉCURITÉ : Gestion copie blanche ou trop courte
    if (answer.trim().length < 10) {
      setResult({ 
        score: 0, 
        feedback: "Copie blanche ou réponse trop succincte. Le jury attend une analyse juridique structurée." 
      })
      setLoading(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: answer, 
          type: 'challenge_grade',
          context: scenario
        })
      })

      const data = await res.json()
      
      try {
        let jsonStr = data.result.trim()
        
        // SÉCURITÉ : Recherche du bloc JSON avec Regex (beaucoup plus robuste)
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          jsonStr = jsonMatch[0]
        }

        const parsed = JSON.parse(jsonStr)
        
        let finalFeedback = ""
        if (typeof parsed.feedback === 'string') {
          finalFeedback = parsed.feedback
        } else {
          // Formatage propre d'un objet feedback complexe
          finalFeedback = JSON.stringify(parsed.feedback, null, 2)
            .replace(/[{}"]/g, '')
            .replace(/:/g, ' :')
        }

        const score = typeof parsed.score === 'number' ? parsed.score : 0

        setResult({ 
          score: score, 
          feedback: finalFeedback || "Analyse terminée." 
        })

        // Award XP (Uniquement si score > 0)
        if (score > 0) {
          const xpGain = score * 5
          const { data: xp } = await supabase.from('user_xp').select('total_xp').eq('id', user.id).single()
          if (xp) {
            await supabase.from('user_xp').update({
              total_xp: xp.total_xp + xpGain
            }).eq('id', user.id)
            window.dispatchEvent(new Event('update-xp'))
          }
        }

        if (score >= 15) {
          confetti({ particleCount: 150, spread: 70, colors: ['#c9a84c', '#ffffff'] })
        }
      } catch (e) {
        // Fallback si erreur de parsing (on met 0 au lieu de 10)
        setResult({ score: 0, feedback: "L'IA n'a pas pu noter votre réponse. Assurez-vous de rédiger un texte clair." })
      }
    } catch (e: any) {
      setError("Erreur lors de la notation.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 transition-all">
        <div className="max-w-4xl mx-auto">
          <header className="mb-10 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-extrabold mb-2 flex items-center gap-3">
                <Zap className="text-indigo-500" size={40} fill="currentColor" />
                Duel IA
              </h1>
              <p className="text-gray-400">Testez vos réflexes juridiques sur un cas concret.</p>
            </div>
            {isActive && (
              <div className={`glass-card px-6 py-4 border-indigo-500/40 flex items-center gap-4 ${timeLeft < 10 ? 'animate-pulse text-red-500' : 'text-white'}`}>
                <Clock size={24} />
                <div className="text-3xl font-black">{timeLeft}s</div>
              </div>
            )}
          </header>

          <UserStatusBar />

          {fetchingDocs ? (
            <div className="text-center p-20 glass-card">
              <Loader2 className="animate-spin text-indigo-500 mx-auto mb-4" size={48} />
              <p className="text-indigo-200">Chargement de vos cours...</p>
            </div>
          ) : !selectedDocId && !scenario ? (
            <div className="animate-in fade-in duration-500">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <CheckCircle2 size={20} className="text-indigo-500" />
                Sélectionnez un cours pour le duel
              </h2>
              
              {documents.length === 0 ? (
                <div className="text-center p-12 glass-card border-dashed border-white/10">
                  <p className="text-gray-500 mb-6">Vous n'avez pas encore de documents. Uploadez un cours pour commencer.</p>
                  <button onClick={() => window.location.href = '/dashboard'} className="btn-premium">Aller à l'upload</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documents.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => startNewChallenge(doc.id)}
                      className="p-6 glass-card text-left hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group relative overflow-hidden"
                    >
                      <h3 className="font-bold text-lg mb-1 group-hover:text-indigo-400 transition-colors">{doc.title}</h3>
                      <p className="text-xs text-gray-500 italic">Ajouté le {new Date(doc.created_at).toLocaleDateString()}</p>
                      <Zap className="absolute -bottom-4 -right-4 text-indigo-500/5 group-hover:text-indigo-500/10 transition-colors" size={80} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : loading && !scenario ? (
            <div className="text-center p-20 glass-card">
              <Loader2 className="animate-spin text-indigo-500 mx-auto mb-4" size={48} />
              <p className="text-indigo-200 font-bold">L'IA analyse votre cours et prépare un cas pratique complexe...</p>
            </div>
          ) : error ? (
            <div className="text-center p-20 glass-card border-red-500/30">
              <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
              <h3 className="text-xl font-bold mb-2">Oups !</h3>
              <p className="text-gray-400 mb-6">{error}</p>
              <button onClick={() => { setSelectedDocId(null); setScenario(null); }} className="btn-premium">Changer de cours</button>
            </div>
          ) : result ? (
            <div className="glass-card p-12 text-center animate-in zoom-in duration-500">
              <Trophy className={result.score >= 15 ? "text-yellow-500 mx-auto mb-6" : "text-gray-500 mx-auto mb-6"} size={80} />
              <h2 className="text-5xl font-black mb-2">{result.score}/20</h2>
              <p className="text-indigo-400 font-bold mb-8 uppercase tracking-widest">
                {result.score >= 15 ? 'Excellent !' : result.score >= 10 ? 'Pas mal !' : 'À revoir'}
              </p>
              
              <div className="p-8 bg-white/5 rounded-3xl mb-8 border border-white/10 text-left max-w-2xl mx-auto shadow-2xl">
                <div className="text-xs text-accent uppercase font-black tracking-widest mb-4 flex items-center gap-2">
                  <GraduationCap size={16} /> Correction Magistrale (Mistral Large)
                </div>
                <div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm md:text-base">
                  {result.feedback}
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                <button onClick={() => { setSelectedDocId(null); setScenario(null); setResult(null); }} className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all text-white">
                  Changer de Cours
                </button>
                <button onClick={() => startNewChallenge(selectedDocId!)} className="btn-premium px-8 py-4">
                  Revanche !
                </button>
              </div>
            </div>
          ) : scenario && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="glass-card p-10 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.05)]">
                <div className="flex items-center gap-2 mb-6 text-indigo-400 font-black uppercase text-[10px] tracking-[0.2em]">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                  Cas Pratique sur mesure
                </div>
                <div
                  className="text-white font-medium leading-relaxed prose prose-invert max-w-none prose-p:leading-relaxed prose-strong:text-indigo-300"
                  dangerouslySetInnerHTML={{
                    __html: scenario
                      .replace(/^#{3} (.+)$/gm, '<h3 class="text-lg font-bold text-indigo-300 mt-4 mb-1">$1</h3>')
                      .replace(/^#{2} (.+)$/gm, '<h2 class="text-xl font-bold text-indigo-400 mt-6 mb-2">$1</h2>')
                      .replace(/^#{1} (.+)$/gm, '<h1 class="text-2xl font-black text-white mt-6 mb-2">$1</h1>')
                      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(.+?)\*/g, '<em>$1</em>')
                      .replace(/^---$/gm, '<hr class="border-white/10 my-4"/>')
                      .replace(/\n\n/g, '</p><p class="mb-2">')
                      .replace(/\n/g, '<br/>')
                  }}
                />
              </div>

              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-[2rem] blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Rédigez votre syllogisme juridique (Majeure, Mineure, Conclusion)..."
                  className="relative w-full h-72 p-8 bg-black/40 backdrop-blur-xl border-2 border-white/5 rounded-[2rem] focus:border-indigo-500/50 focus:outline-none transition-all text-white text-lg placeholder:text-gray-600 resize-none shadow-inner"
                  disabled={loading}
                />
                <button 
                  onClick={submitAnswer}
                  disabled={loading || !answer.trim()}
                  className="absolute bottom-8 right-8 p-5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl shadow-2xl shadow-indigo-500/40 transition-all hover:scale-110 active:scale-95 disabled:opacity-50 disabled:grayscale"
                >
                  {loading ? <Loader2 className="animate-spin" size={28} /> : <Send size={28} />}
                </button>
              </div>
              <p className="text-center text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                L'IA analyse votre rigueur juridique et votre capacité de synthèse.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
