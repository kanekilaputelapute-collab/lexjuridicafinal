import { createClient } from '@/lib/supabase/client'

export async function updateGamification(userId: string, type: 'flashcard' | 'upload' | 'focus') {
  const supabase = createClient()

  // 1. Update Stats & Streak
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
      const diff = (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)

      if (diff === 1) {
        newStreak += 1
      } else if (diff > 1) {
        newStreak = 1
      }
    } else {
      newStreak = 1
    }

    const updates: any = { last_streak_date: today.toISOString() }
    if (newStreak !== stats.streak_days) updates.streak_days = newStreak
    
    if (type === 'flashcard') updates.cards_reviewed = (stats.cards_reviewed || 0) + 1
    
    await supabase.from('user_stats').update(updates).eq('id', userId)
  }

  // 2. Update Quests
  const { data: quests } = await supabase
    .from('user_quests')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', false)

  if (quests) {
    for (const quest of quests) {
      let increment = 0
      if (quest.quest_type === 'flashcards' && type === 'flashcard') increment = 1
      if (quest.quest_type === 'upload' && type === 'upload') increment = 1
      if (quest.quest_type === 'focus' && type === 'focus') increment = 1

      if (increment > 0) {
        const newCount = (quest.current_count || 0) + increment
        const isCompleted = newCount >= quest.target_count
        
        await supabase.from('user_quests').update({
          current_count: newCount,
          completed: isCompleted
        }).eq('id', quest.id)

        if (isCompleted) {
          // Reward XP
          const { data: xp } = await supabase.from('user_xp').select('total_xp').eq('id', userId).single()
          if (xp) {
            await supabase.from('user_xp').update({
              total_xp: xp.total_xp + quest.xp_reward
            }).eq('id', userId)
            window.dispatchEvent(new Event('update-xp'))
          }
        }
      }
    }
  }
}
