import { createClient } from '@/lib/supabase/client'

export async function updateGamification(userId: string, type: 'flashcards' | 'upload' | 'focus') {
  const supabase = createClient()

  // 1. Update Stats & Streak (Optimized)
  const { data: stats } = await supabase
    .from('user_stats')
    .select('*')
    .eq('id', userId)
    .single()

  if (stats) {
    let newStreak = stats.streak_days || 0
    const lastDate = stats.last_streak_date ? new Date(stats.last_streak_date) : null
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (lastDate) {
      lastDate.setHours(0, 0, 0, 0)
      const diff = Math.round((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

      if (diff === 1) {
        newStreak += 1
      } else if (diff > 1) {
        newStreak = 1
      } else if (diff === 0) {
        newStreak = stats.streak_days || 1
      }
    } else {
      newStreak = 1
    }

    const updates: any = { last_streak_date: today.toISOString() }
    if (newStreak !== stats.streak_days) updates.streak_days = newStreak
    
    // Utiliser des incréments relatifs si possible (ici limitation Supabase client sans RPC)
    if (type === 'flashcards') updates.cards_reviewed = (stats.cards_reviewed || 0) + 1
    if (type === 'upload') updates.documents_uploaded = (stats.documents_uploaded || 0) + 1
    
    await supabase.from('user_stats').update(updates).eq('id', userId)
  }

  // 2. Update Quests (Direct update)
  const { data: quests } = await supabase
    .from('user_quests')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', false)

  if (quests) {
    for (const quest of quests) {
      let shouldUpdate = false
      if (quest.quest_type === 'flashcards' && type === 'flashcards') shouldUpdate = true
      if (quest.quest_type === 'upload' && type === 'upload') shouldUpdate = true
      if (quest.quest_type === 'focus' && type === 'focus') shouldUpdate = true

      if (shouldUpdate) {
        const newCount = (quest.current_count || 0) + 1
        const isCompleted = newCount >= quest.target_count
        
        // Mise à jour atomique de la ligne de quête
        await supabase.from('user_quests').update({
          current_count: newCount,
          completed: isCompleted
        }).eq('id', quest.id)

        if (isCompleted) {
          // Utilisation d'un trigger DB serait idéale, sinon on fait au mieux ici
          const { data: xpData } = await supabase.from('user_xp').select('total_xp').eq('id', userId).single()
          if (xpData) {
            await supabase.from('user_xp').update({
              total_xp: xpData.total_xp + quest.xp_reward
            }).eq('id', userId)
            window.dispatchEvent(new Event('update-xp'))
          }
        }
      }
    }
  }
}
