'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import UserStatusBar from '@/components/UserStatusBar'
import DocumentUpload from '@/components/DocumentUpload'
import { FileText, ChevronRight, Clock, Star, Upload } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const [recentDocs, setRecentDocs] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [totalCards, setTotalCards] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    let focusInterval: any

    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch Recent Docs
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      // Fetch Real Stats
      const { data: userStats } = await supabase
        .from('user_stats')
        .select('*')
        .eq('id', user.id)
        .single()

      // Count actual cards in SRS
      const { count } = await supabase
        .from('user_srs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setTotalCards(count || 0)
      setRecentDocs(docs || [])
      setStats(userStats)
      setLoading(false)

      // Increment focus minutes every 60 seconds
      focusInterval = setInterval(async () => {
        const { data: currentStats } = await supabase
          .from('user_stats')
          .select('focus_minutes')
          .eq('id', user.id)
          .single()
        
        const newMinutes = (currentStats?.focus_minutes || 0) + 1
        
        await supabase
          .from('user_stats')
          .update({ focus_minutes: newMinutes })
          .eq('id', user.id)
        
        setStats((prev: any) => prev ? { ...prev, focus_minutes: newMinutes } : prev)
      }, 60000)
    }

    fetchData()
    return () => {
      if (focusInterval) clearInterval(focusInterval)
    }
  }, [])

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 transition-all">
        <div className="max-w-6xl mx-auto">
          <header className="mb-10">
            <h1 className="text-4xl font-extrabold mb-2">Tableau de Bord</h1>
            <p className="text-gray-400">Prêt pour votre session de révision juridique ?</p>
          </header>

          <UserStatusBar />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
            <div className="lg:col-span-2 space-y-8">
              <section>
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <FileText size={20} className="text-accent" />
                    Documents Récents
                  </h2>
                  <Link href="/documents" className="text-xs text-accent hover:underline">Voir tout</Link>
                </div>

                <div className="space-y-3">
                  {loading ? (
                    [1, 2, 3].map(i => <div key={i} className="h-20 glass-card animate-pulse" />)
                  ) : recentDocs.length === 0 ? (
                    <div className="p-8 text-center glass-card text-gray-500">
                      Aucun document pour le moment.
                    </div>
                  ) : (
                    recentDocs.map(doc => (
                      <Link 
                        key={doc.id} 
                        href={`/documents/${doc.id}`}
                        className="flex items-center gap-4 p-4 glass-card hover:bg-white/5 transition-all group"
                      >
                        <div className="p-3 bg-accent/10 text-accent rounded-lg">
                          <FileText size={24} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold group-hover:text-accent transition-colors">{doc.title}</h3>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                            <span className="flex items-center gap-1"><Clock size={12}/> {new Date(doc.created_at).toLocaleDateString()}</span>
                            <span>{Math.round(doc.size / 1024)} KB</span>
                          </div>
                        </div>
                        <ChevronRight className="text-gray-600 group-hover:text-accent transition-all transform group-hover:translate-x-1" />
                      </Link>
                    ))
                  )}
                </div>
              </section>

              <section className="p-8 glass-card bg-accent/5 border-accent/30 relative overflow-hidden">
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Star className="text-accent fill-accent" size={24} />
                    LexJuridica Premium
                  </h2>
                  <p className="text-gray-400 mb-6 max-w-md">
                    Gagnez des XP en révisant vos flashcards tous les jours pour monter dans le classement national.
                  </p>
                  <Link href="/revision" className="btn-premium inline-block">
                    Lancer une Session SRS
                  </Link>
                </div>
                <div className="absolute top-0 right-0 p-8 text-accent/10 transform translate-x-1/4 -translate-y-1/4 scale-150">
                  <Trophy size={120} />
                </div>
              </section>
            </div>

            <div className="space-y-8">
              <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Upload size={20} className="text-accent" />
                  Nouveau Cours
                </h2>
                <DocumentUpload />
              </section>

              <section className="glass-card p-6">
                <h3 className="font-bold mb-4">Statistiques</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Cartes révisées</span>
                    <span className="font-bold">{totalCards}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Heures de focus</span>
                    <span className="font-bold">
                      {(stats?.focus_minutes ? stats.focus_minutes / 60 : 0).toFixed(1)}h
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Précision IA</span>
                    <span className="font-bold text-green-400">99.9%</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function Trophy({ size }: { size: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 4H6v7a6 6 0 0 0 12 0V4Z" />
    </svg>
  )
}
