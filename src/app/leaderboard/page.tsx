'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import UserStatusBar from '@/components/UserStatusBar'
import { Trophy, Medal, Award, TrendingUp, User, Star, Loader2 } from 'lucide-react'

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [currentUserRank, setCurrentUserRank] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchLeaderboard() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/'
        return
      }

      const { data: board } = await supabase
        .from('user_xp')
        .select('id, email, total_xp, level, rank_title')
        .order('total_xp', { ascending: false })
        .limit(20)

      // SÉCURITÉ : On ne garde qu'une version masquée de l'email AVANT de la mettre en state
      const sanitizedBoard = (board || []).map(u => ({
        ...u,
        displayName: maskEmail(u.email)
      }))

      setLeaderboard(sanitizedBoard)
      
      const userRank = sanitizedBoard.findIndex(u => u.id === user.id)
      if (sanitizedBoard && userRank !== undefined && userRank !== -1) {
        setCurrentUserRank({ rank: userRank + 1, ...sanitizedBoard[userRank] })
      }
      
      setLoading(false)
    }
    fetchLeaderboard()
  }, [])

  const maskEmail = (email: string) => {
    if (!email) return 'Anonyme'
    const [local] = email.split('@')
    if (local.length <= 2) return local[0] + '***'
    return local[0] + '***' + local[local.length - 1]
  }

  const topThree = leaderboard.slice(0, 3)
  const others = leaderboard.slice(3)

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 transition-all">
        <div className="max-w-6xl mx-auto">
          <header className="mb-10 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-extrabold mb-2 flex items-center gap-3">
                <Trophy className="text-accent" size={40} />
                Classement National
              </h1>
              <p className="text-gray-400">L'élite des étudiants en droit de LexJuridica.</p>
            </div>
            {currentUserRank && (
              <div className="glass-card px-6 py-4 border-accent/40 bg-accent/5">
                <div className="text-xs text-accent uppercase tracking-widest font-bold">Votre Rang</div>
                <div className="text-2xl font-black">#{currentUserRank.rank}</div>
              </div>
            )}
          </header>

          <UserStatusBar />

          {loading ? (
            <div className="flex justify-center p-20">
              <Loader2 className="animate-spin text-accent" size={40} />
            </div>
          ) : (
            <div className="space-y-12">
              {/* Podium */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                {/* 2nd Place */}
                {topThree[1] && (
                  <div className="glass-card p-6 h-[200px] relative flex flex-col items-center justify-center border-blue-400/20 order-2 md:order-1">
                    <Medal className="text-gray-400 mb-2" size={32} />
                    <div className="text-lg font-bold">{maskEmail(topThree[1].email)}</div>
                    <div className="text-accent font-black">{topThree[1].total_xp} XP</div>
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-gray-400 text-black text-xs font-black rounded-full">#2</div>
                  </div>
                )}
                
                {/* 1st Place */}
                {topThree[0] && (
                  <div className="glass-card p-8 h-[250px] relative flex flex-col items-center justify-center border-accent/50 scale-105 bg-accent/5 order-1 md:order-2">
                    <Trophy className="text-accent mb-4 animate-bounce" size={48} />
                    <div className="text-xl font-black">{maskEmail(topThree[0].email)}</div>
                    <div className="text-accent text-2xl font-black">{topThree[0].total_xp} XP</div>
                    <div className="text-xs text-gray-400 mt-2">{topThree[0].rank_title}</div>
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-accent text-black text-sm font-black rounded-full shadow-lg shadow-accent/20">#1</div>
                  </div>
                )}

                {/* 3rd Place */}
                {topThree[2] && (
                  <div className="glass-card p-6 h-[180px] relative flex flex-col items-center justify-center border-orange-400/20 order-3">
                    <Medal className="text-orange-500/60 mb-2" size={32} />
                    <div className="text-lg font-bold">{maskEmail(topThree[2].email)}</div>
                    <div className="text-accent font-black">{topThree[2].total_xp} XP</div>
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-orange-700 text-white text-xs font-black rounded-full">#3</div>
                  </div>
                )}
              </div>

              {/* Leaderboard Table */}
              <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/5">
                      <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500">Rang</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500">Utilisateur</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500 text-right">Niveau</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500 text-right">Total XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {others.map((u, i) => (
                      <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-500">#{i + 4}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">
                              {u.email[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold">{maskEmail(u.email)}</div>
                              <div className="text-[10px] text-accent/70 uppercase font-black">{u.rank_title}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold">{u.level}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-accent font-black">{u.total_xp}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
