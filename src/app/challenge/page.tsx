'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import UserStatusBar from '@/components/UserStatusBar'
import { Zap, Send, Loader2, Trophy, Clock, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import confetti from 'canvas-confetti'

export default function ChallengePage() {
  const [scenario, setScenario] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<{ score: number, feedback: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    startNewChallenge()
  }, [])

  useEffect(() => {
    let timer: any
    if (isActive && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
    } else if (timeLeft === 0 && isActive) {
      submitAnswer()
    }
    return () => clearInterval(timer)
  }, [isActive, timeLeft])

  async function startNewChallenge() {
    setLoading(true)
    setError(null)
    setResult(null)
    setAnswer('')
    setTimeLeft(60)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return window.location.href = '/'

      // Get context from recent documents
      const { data: docs } = await supabase
        .from('documents')
        .select('summary_html')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (!docs || docs.length === 0) {
        setError("Uploadez au moins un document pour générer un challenge personnalisé.")
        setLoading(false)
        return
      }

      const cleanText = docs[0].summary_html.replace(/<[^>]*>/g, '').substring(0, 4000)

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, type: 'challenge_gen' })
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
    if (!answer.trim() && timeLeft > 0) return
    setIsActive(false)
    setLoading(true)

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
      // Gemini renvoie du JSON natif maintenant
      try {
        const parsed = JSON.parse(data.result)
        setResult({ 
          score: parsed.score || 10, 
          feedback: parsed.feedback || "Analyse terminée." 
        })

        // Award XP
        const xpGain = (parsed.score || 10) * 5
        const { data: xp } = await supabase.from('user_xp').select('total_xp').eq('id', user.id).single()
        if (xp) {
          await supabase.from('user_xp').update({
            total_xp: xp.total_xp + xpGain
          }).eq('id', user.id)
          window.dispatchEvent(new Event('update-xp'))
        }

        if ((parsed.score || 0) >= 15) {
          confetti({ particleCount: 150, spread: 70, colors: ['#c9a84c', '#ffffff'] })
        }
      } catch (e) {
        // Fallback si Gemini renvoie du texte au lieu du JSON malgré la config
        setResult({ score: 10, feedback: data.result })
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
            <div className={`glass-card px-6 py-4 border-indigo-500/40 flex items-center gap-4 ${timeLeft < 10 && isActive ? 'animate-pulse text-red-500' : 'text-white'}`}>
              <Clock size={24} />
              <div className="text-3xl font-black">{timeLeft}s</div>
            </div>
          </header>

          <UserStatusBar />

          {loading && !scenario ? (
            <div className="text-center p-20 glass-card">
              <Loader2 className="animate-spin text-indigo-500 mx-auto mb-4" size={48} />
              <p className="text-indigo-200 font-bold">L'IA prépare votre cas pratique...</p>
            </div>
          ) : error ? (
            <div className="text-center p-20 glass-card border-red-500/30">
              <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
              <h3 className="text-xl font-bold mb-2">Oups !</h3>
              <p className="text-gray-400 mb-6">{error}</p>
              <button onClick={startNewChallenge} className="btn-premium">Réessayer</button>
            </div>
          ) : result ? (
            <div className="glass-card p-12 text-center animate-in zoom-in duration-500">
              <Trophy className={result.score >= 15 ? "text-yellow-500 mx-auto mb-6" : "text-gray-500 mx-auto mb-6"} size={80} />
              <h2 className="text-5xl font-black mb-2">{result.score}/20</h2>
              <p className="text-indigo-400 font-bold mb-8 uppercase tracking-widest">
                {result.score >= 15 ? 'Excellent !' : result.score >= 10 ? 'Pas mal !' : 'À revoir'}
              </p>
              
              <div className="p-6 bg-white/5 rounded-2xl mb-8 border border-white/10 text-left max-w-lg mx-auto">
                <div className="text-xs text-gray-500 uppercase font-bold mb-2">Verdict du jury</div>
                <p className="text-gray-300 leading-relaxed italic">"{result.feedback}"</p>
              </div>

              <div className="flex gap-4 justify-center">
                <button onClick={() => window.location.href = '/dashboard'} className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all text-white">
                  Dashboard
                </button>
                <button onClick={startNewChallenge} className="btn-premium px-8 py-4">
                  Nouveau Duel
                </button>
              </div>
            </div>
          ) : scenario && (
            <div className="space-y-8 animate-in fade-in duration-700">
              <div className="glass-card p-8 bg-indigo-500/5 border-indigo-500/20">
                <div className="flex items-center gap-2 mb-4 text-indigo-400 font-black uppercase text-xs tracking-widest">
                  <CheckCircle2 size={14} /> Cas Pratique du Jour
                </div>
                <p className="text-xl text-white font-medium leading-relaxed italic">
                  "{scenario}"
                </p>
              </div>

              <div className="relative">
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Rédigez votre solution juridique ici..."
                  className="w-full h-64 p-8 bg-white/5 border-2 border-white/10 rounded-3xl focus:border-indigo-500 focus:outline-none transition-all text-white text-lg placeholder:text-gray-600 resize-none"
                  disabled={loading}
                />
                <button 
                  onClick={submitAnswer}
                  disabled={loading || !answer.trim()}
                  className="absolute bottom-6 right-6 p-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/20 transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                </button>
              </div>
              <p className="text-center text-xs text-gray-500">
                L'IA analyse votre rigueur juridique et votre capacité de synthèse.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
