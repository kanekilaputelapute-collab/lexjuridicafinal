'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateNextReview, SRSGrade, SRSCard, getIntervalPreview } from '@/lib/srs'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from '@/components/Sidebar'
import UserStatusBar from '@/components/UserStatusBar'
import { Brain, Play, ChevronRight, Loader2, BookOpen, Edit2, Download, Check, X, Trash2 } from 'lucide-react'
import confetti from 'canvas-confetti'
import { generateSRSPDF } from '@/lib/pdf'
import { updateGamification } from '@/lib/gamification'
import { useRouter } from 'next/navigation'

export default function RevisionPage() {
  const [decks, setDecks] = useState<any[]>([])
  const [selectedDeck, setSelectedDeck] = useState<any>(null)
  const [cards, setCards] = useState<any[]>([])
  const [isFreeRevision, setIsFreeRevision] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [xpFlash, setXpFlash] = useState<number | null>(null)
  const [sessionFinished, setSessionFinished] = useState<{ nextDate: Date | null } | null>(null)
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)
  const [now, setNow] = useState(new Date())
  
  const supabase = createClient()
  const router = useRouter()

  const fetchDecks = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }

    const { data: decksData } = await supabase
      .from('decks')
      .select(`*, user_srs ( id, next_review, repetition, front, back, ease_factor, interval )`)
      .eq('user_id', user.id)

    const processedDecks = decksData?.map(deck => {
      const cards = deck.user_srs || []
      
      // Sort to find the very next review scheduled
      const sortedByNext = [...cards].sort((a, b) => new Date(a.next_review).getTime() - new Date(b.next_review).getTime())
      const nextReviewDate = sortedByNext.length > 0 ? new Date(sortedByNext[0].next_review) : null

      return {
        ...deck,
        cards_raw: cards,
        total: cards.length,
        due: cards.filter((c: any) => new Date(c.next_review) <= new Date()).length,
        new: cards.filter((c: any) => c.repetition === 0).length,
        next_due_at: nextReviewDate
      }
    })

    setDecks(processedDecks || [])
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    fetchDecks()
    
    // Auto-refresh the 'due' status every 30 seconds
    const timer = setInterval(() => {
      const currentNow = new Date()
      setNow(currentNow)
      setDecks(prevDecks => prevDecks.map(deck => ({
        ...deck,
        due: deck.cards_raw.filter((c: any) => new Date(c.next_review) <= currentNow).length
      })))
    }, 30000)

    // Keyboard support: Space bar to flip
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && selectedDeck && cards.length > 0 && !sessionFinished) {
        e.preventDefault() // Prevent scrolling
        setIsFlipped(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      clearInterval(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedDeck, cards.length, sessionFinished, fetchDecks])

  const handleRename = async (deckId: string) => {
    if (!newTitle.trim()) return
    const { error } = await supabase.from('decks').update({ title: newTitle }).eq('id', deckId)
    if (!error) {
      setDecks(decks.map(d => d.id === deckId ? { ...d, title: newTitle } : d))
      setEditingDeckId(null)
      showNotification('Deck renommé !')
    }
  }

  const handleDeleteDeck = async (deckId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce deck ? Toutes les cartes associées seront perdues.")) return

    // 1. Supprimer explicitement les cartes du deck
    await supabase.from('user_srs').delete().eq('deck_id', deckId)

    // 2. Supprimer le deck
    const { error } = await supabase.from('decks').delete().eq('id', deckId)
    
    if (error) {
      showNotification('Erreur lors de la suppression', 'error')
    } else {
      setDecks(decks.filter(d => d.id !== deckId))
      showNotification('Deck supprimé avec succès')
    }
  }

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleExportPDF = async (deck: any) => {
    await generateSRSPDF(deck)
  }

  const startSession = async (deck: any, free = false) => {
    const now = new Date().toISOString()
    let query = supabase
      .from('user_srs')
      .select('*')
      .eq('deck_id', deck.id)
    
    if (!free) {
      query = query.lte('next_review', now).order('next_review', { ascending: true })
    } else {
      query = query.order('id', { ascending: true })
    }

    const { data: fetchedCards } = await query

    if (fetchedCards && fetchedCards.length > 0) {
      setCards(fetchedCards)
      setSelectedDeck(deck)
      setIsFreeRevision(free)
      setCurrentIdx(0)
      setSessionFinished(null)
    } else {
      alert(free ? "Aucune carte dans ce deck !" : "Aucune carte due !")
    }
  }

  const [isEditingCard, setIsEditingCard] = useState(false)
  const [editedFront, setEditedFront] = useState('')
  const [editedBack, setEditedBack] = useState('')

  const handleSaveEdit = async () => {
    const card = cards[currentIdx]
    const { error } = await supabase
      .from('user_srs')
      .update({ front: editedFront, back: editedBack })
      .eq('id', card.id)

    if (!error) {
      const updatedCards = [...cards]
      updatedCards[currentIdx] = { ...card, front: editedFront, back: editedBack }
      setCards(updatedCards)
      setIsEditingCard(false)
      showNotification('Carte mise à jour !')
    } else {
      showNotification('Erreur lors de la mise à jour', 'error')
    }
  }

  const handleGrade = async (grade: SRSGrade) => {
    const card = cards[currentIdx]

    // Si Again : remettre la carte à la fin de la session et ne pas avancer
    if (grade === 0) {
      const nextSRS = calculateNextReview({
        ease_factor: card.ease_factor ?? 2.5,
        interval: card.interval ?? 0,
        repetition: card.repetition ?? 0,
        next_review: new Date(card.next_review)
      }, 0)

      await supabase.from('user_srs').update({
        ease_factor: nextSRS.ease_factor,
        interval: nextSRS.interval,
        repetition: nextSRS.repetition,
        next_review: nextSRS.next_review.toISOString()
      }).eq('id', card.id)

      // XP minimal pour Again
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: xp } = await supabase.from('user_xp').select('total_xp, level').eq('id', user.id).single()
        if (xp) {
          await supabase.from('user_xp').update({
            total_xp: xp.total_xp + 2,
            level: Math.floor((xp.total_xp + 2) / 1000) + 1
          }).eq('id', user.id)
          
          await updateGamification(user.id, 'flashcards')
          window.dispatchEvent(new Event('update-xp'))
        }
      }

      setXpFlash(2)
      setTimeout(() => setXpFlash(null), 800)

      // Remettre la carte à la fin du deck courant
      setCards(prev => {
        const updated = [...prev]
        const failedCard = { ...updated.splice(currentIdx, 1)[0] }
        updated.push(failedCard)
        return updated
      })

      setIsFlipped(false)
      return // Ne pas continuer le reste de handleGrade
    }

    const nextSRS = calculateNextReview({
      ease_factor: card.ease_factor ?? 2.5,
      interval: card.interval ?? 0,
      repetition: card.repetition ?? 0,
      next_review: new Date(card.next_review)
    }, grade)
    
    setXpFlash(grade === 1 ? 10 : grade === 2 ? 20 : 35)
    setTimeout(() => setXpFlash(null), 800)

    // Even in free revision, we update the SRS to reward the effort
    await supabase.from('user_srs').update({
      ease_factor: nextSRS.ease_factor,
      interval: nextSRS.interval,
      repetition: nextSRS.repetition,
      next_review: nextSRS.next_review.toISOString()
    }).eq('id', card.id)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: xp } = await supabase.from('user_xp').select('total_xp, level').eq('id', user.id).single()
      
      if (xp) {
        const xpGain = grade === 1 ? 10 : grade === 2 ? 20 : 35;
        await supabase.from('user_xp').update({ 
          total_xp: xp.total_xp + xpGain, 
          level: Math.floor((xp.total_xp + xpGain)/1000)+1 
        }).eq('id', user.id)
        
        await updateGamification(user.id, 'flashcards')
        window.dispatchEvent(new Event('update-xp'))
      }
    }

    setIsFlipped(false)
    setTimeout(async () => {
      if (currentIdx < cards.length - 1) {
        setCurrentIdx(prev => prev + 1)
      } else {
        confetti({ particleCount: 150, spread: 70, colors: ['#c9a84c', '#ffffff'] })
        const { data: nextCard } = await supabase.from('user_srs').select('next_review').eq('deck_id', selectedDeck.id).order('next_review', { ascending: true }).limit(1).single()
        setSessionFinished({ nextDate: nextCard ? new Date(nextCard.next_review) : null })
        setCards([])
        setIsFreeRevision(false)
      }
    }, 300)
  }

  const getTimeRemaining = (date: Date | null) => {
    if (!date) return 'Dans quelques jours'
    const diffMin = Math.round((date.getTime() - Date.now()) / 60000)
    if (diffMin <= 0) return "Immédiatement"
    if (diffMin < 60) return `Dans ${diffMin} min`
    if (diffMin < 1440) return `Dans ${Math.round(diffMin/60)} h`
    return `Le ${date.toLocaleDateString()}`
  }

  if (loading) return <div className="p-8 text-center text-accent"><Loader2 className="animate-spin mx-auto mb-4" /> Chargement...</div>

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 transition-all">
        <UserStatusBar />
        
        <div className="max-w-4xl mx-auto">
          <AnimatePresence>
            {message && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -20 }}
                className={`fixed top-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl font-bold shadow-2xl border ${message.type === 'success' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-red-500/20 border-red-500 text-red-400'}`}
              >
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>

          {!selectedDeck && !sessionFinished ? (
            <>
              <header className="mb-10 flex justify-between items-end">
                <div>
                  <h1 className="text-4xl font-extrabold mb-2 flex items-center gap-3"><Brain className="text-accent" size={40} /> Révision SRS</h1>
                  <p className="text-gray-400">Logique Anki : Maîtrisez le droit sur le long terme.</p>
                </div>
              </header>

              <div className="grid gap-4">
                {decks.length === 0 ? (
                  <div className="text-center p-12 glass-card">
                    <p className="text-gray-500 mb-6">Aucun deck. Uploadez un cours pour commencer.</p>
                    <a href="/dashboard" className="btn-premium inline-block">Uploader</a>
                  </div>
                ) : (
                  decks.map(deck => (
                    <div key={deck.id} className="glass-card p-6 flex items-center justify-between group hover:border-accent/50 transition-all">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="p-3 bg-accent/10 text-accent rounded-xl"><BookOpen size={24} /></div>
                        <div className="flex-1">
                          {editingDeckId === deck.id ? (
                            <div className="flex items-center gap-2">
                              <input 
                                autoFocus
                                className="bg-white/5 border border-accent rounded px-2 py-1 text-white outline-none"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleRename(deck.id)}
                              />
                              <button onClick={() => handleRename(deck.id)} className="text-green-500"><Check size={18}/></button>
                              <button onClick={() => setEditingDeckId(null)} className="text-red-500"><X size={18}/></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <h3 className="font-bold text-lg">{deck.title}</h3>
                              <button onClick={() => { setEditingDeckId(deck.id); setNewTitle(deck.title); }} className="text-gray-600 hover:text-accent opacity-0 group-hover:opacity-100 transition-all"><Edit2 size={14}/></button>
                            </div>
                          )}
                          <div className="flex gap-4 mt-1">
                            <span className="text-xs font-bold text-blue-400">{deck.new} Nouveaux</span>
                            <span className="text-xs font-bold text-green-400">{deck.due} Dues</span>
                            <span className="text-xs font-bold text-gray-500">{deck.total} Cartes</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => handleExportPDF(deck)} className="p-2 text-gray-500 hover:text-accent transition-colors" title="Exporter en PDF"><Download size={18}/></button>
                        
                        <button onClick={() => handleDeleteDeck(deck.id)} className="p-2 text-gray-500 hover:text-red-500 transition-colors" title="Supprimer le deck"><Trash2 size={18}/></button>

                        <button 
                          onClick={() => startSession(deck, true)}
                          className="px-4 py-3 rounded-xl font-bold text-xs bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all border border-white/5"
                        >
                          Libre
                        </button>

                        <button 
                          onClick={() => startSession(deck)}
                          disabled={deck.due === 0}
                          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all min-w-[140px] justify-center ${deck.due > 0 ? 'bg-accent text-black hover:scale-105' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}
                        >
                          {deck.due > 0 ? (
                            <><Play size={18} /> Réviser</>
                          ) : (
                            <span className="text-[10px] uppercase tracking-tighter">
                              {deck.next_due_at ? getTimeRemaining(deck.next_due_at) : 'À jour'}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : sessionFinished ? (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md mx-auto text-center p-12 glass-card border-accent/50 shadow-2xl">
              <div className="text-6xl mb-6">🏆</div>
              <h2 className="text-3xl font-black mb-4 uppercase tracking-tighter">Deck Terminé !</h2>
              <div className="p-6 bg-white/5 rounded-2xl mb-8 border border-white/10">
                <div className="text-xs text-gray-500 uppercase font-bold mb-2">Prochain rendez-vous</div>
                <div className="text-xl font-bold text-accent">{getTimeRemaining(sessionFinished.nextDate)} ⏳</div>
              </div>
              <button onClick={() => { setSessionFinished(null); setSelectedDeck(null); fetchDecks(); }} className="w-full btn-premium py-4 flex items-center justify-center gap-2">Retour <ChevronRight size={18} /></button>
            </motion.div>
          ) : (
            <div className="max-w-2xl mx-auto relative">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedDeck(null)} className="text-xs text-gray-500 hover:text-white flex items-center gap-1"><ChevronRight size={14} className="rotate-180" /> Quitter</button>
                  {!isEditingCard && (
                    <button 
                      onClick={() => {
                        setEditedFront(cards[currentIdx].front)
                        setEditedBack(cards[currentIdx].back)
                        setIsEditingCard(true)
                      }} 
                      className="text-xs text-accent hover:underline flex items-center gap-1"
                    >
                      <Edit2 size={12} /> Modifier la carte
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {isFreeRevision && <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-black rounded border border-blue-500/30 tracking-tighter">MODE LIBRE</span>}
                  <div className="text-xs font-bold uppercase tracking-widest text-accent">Session : {selectedDeck.title} ({currentIdx + 1}/{cards.length})</div>
                </div>
              </div>
              
              <AnimatePresence>
                {xpFlash && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: -40 }} exit={{ opacity: 0 }} className="absolute left-1/2 -translate-x-1/2 text-2xl font-black text-accent z-50">+{xpFlash} XP</motion.div>}
              </AnimatePresence>

              {isEditingCard ? (
                <div className="glass-card p-8 space-y-6 animate-in fade-in zoom-in duration-300">
                  <div>
                    <label className="block text-xs font-bold text-accent uppercase mb-2">Question (Recto)</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-accent outline-none min-h-[100px] resize-none"
                      value={editedFront}
                      onChange={(e) => setEditedFront(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-accent uppercase mb-2">Réponse (Verso)</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-accent outline-none min-h-[150px] resize-none"
                      value={editedBack}
                      onChange={(e) => setEditedBack(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-4">
                    <button onClick={handleSaveEdit} className="flex-1 btn-premium py-3 flex items-center justify-center gap-2">
                      <Check size={18} /> Enregistrer
                    </button>
                    <button onClick={() => setIsEditingCard(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 py-3 rounded-xl font-bold transition-all border border-white/10 flex items-center justify-center gap-2">
                      <X size={18} /> Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative h-[400px] perspective-1000">
                  <motion.div 
                    key={cards[currentIdx].id} 
                    initial={{ rotateY: 0 }} 
                    animate={{ rotateY: isFlipped ? 180 : 0 }} 
                    transition={{ duration: 0.6, type: 'spring' }} 
                    className="w-full h-full relative preserve-3d cursor-pointer" 
                    onClick={() => setIsFlipped(prev => !prev)}
                  >
                    <div className={`absolute inset-0 backface-hidden glass-card p-8 flex flex-col items-center justify-center text-center`}>
                      <div className="text-xs text-accent uppercase tracking-widest mb-4">Question</div>
                      <div className="text-xl font-medium">{cards[currentIdx].front}</div>
                    </div>
                    <div className={`absolute inset-0 backface-hidden glass-card p-8 flex flex-col items-center justify-center text-center rotate-y-180`}>
                      <div className="text-xs text-accent uppercase tracking-widest mb-4">Réponse</div>
                      <div className="text-lg leading-relaxed">{cards[currentIdx].back}</div>
                    </div>
                  </motion.div>
                  {isFlipped && (
                    <div className="mt-8 grid grid-cols-4 gap-4">
                      {[0, 1, 2, 3].map((g) => (
                        <button key={g} onClick={() => handleGrade(g as SRSGrade)} className={`p-4 rounded-xl transition-all border border-white/10 hover:border-accent group ${g === 0 ? 'hover:bg-red-500/10' : g === 1 ? 'hover:bg-orange-500/10' : 'hover:bg-green-500/10'}`}>
                          <div className="text-sm font-bold capitalize">{g === 0 ? 'Again' : g === 1 ? 'Hard' : g === 2 ? 'Good' : g === 3 ? 'Easy' : ''}</div>
                          <div className="text-xs text-gray-500 mt-1">{getIntervalPreview(cards[currentIdx], g as SRSGrade)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <style jsx global>{`.perspective-1000 { perspective: 1000px; } .preserve-3d { transform-style: preserve-3d; } .backface-hidden { backface-visibility: hidden; } .rotate-y-180 { transform: rotateY(180deg); }`}</style>
    </div>
  )
}
