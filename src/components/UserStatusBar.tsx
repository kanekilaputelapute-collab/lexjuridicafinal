'use client'
import { useEffect, useState } from 'react'
import { Zap, Award } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function UserStatusBar() {
  const [xpData, setXpData] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const supabase = createClient()

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: xp } = await supabase.from('user_xp').select('*').eq('id', user.id).single()
    const { data: st } = await supabase.from('user_stats').select('*').eq('id', user.id).single()
    
    setXpData(xp)
    setStats(st)
  }

  useEffect(() => {
    fetchData()
    
    // Écouteur pour mise à jour manuelle (déclenché par la révision)
    const handleXpUpdate = () => fetchData()
    window.addEventListener('update-xp', handleXpUpdate)
    
    return () => window.removeEventListener('update-xp', handleXpUpdate)
  }, [])

  if (!xpData || !stats) return null

  const progress = (xpData.total_xp % 1000) / 10

  return (
    <div className="flex gap-6 items-center p-4 glass-card mb-8 animate-in slide-in-from-top duration-500">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent/20 rounded-lg text-accent">
          <Award size={24} />
        </div>
        <div>
          <div className="text-xs text-gray-400">Niveau {xpData.level}</div>
          <div className="font-bold">{xpData.rank_title}</div>
        </div>
      </div>

      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span>{xpData.total_xp} XP</span>
          <span>{xpData.level * 1000} XP</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-accent transition-all duration-700" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 px-6 border-l border-white/10">
        <Zap size={20} className={stats.ai_energy > 10 ? 'text-yellow-400' : 'text-red-400'} />
        <div>
          <div className="text-xs text-gray-400">Énergie IA</div>
          <div className="font-bold">{stats.ai_energy}/40</div>
        </div>
      </div>
    </div>
  )
}
