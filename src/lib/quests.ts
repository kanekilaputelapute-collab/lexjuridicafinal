import { createClient } from '@/lib/supabase/client'

export type QuestType = 'flashcards' | 'upload' | 'focus'

export interface Quest {
  id?: string
  user_id: string
  title: string
  quest_type: QuestType
  target_count: number
  current_count: number
  xp_reward: number
  completed: boolean
  is_weekly: boolean
  expires_at: string
}

const DAILY_QUESTS_POOL = [
  { title: "Réviser 20 flashcards", type: "flashcards", target: 20, xp: 150 },
  { title: "Réviser 50 flashcards", type: "flashcards", target: 50, xp: 400 },
  { title: "Uploader 1 nouveau cours", type: "upload", target: 1, xp: 200 },
  { title: "Uploader 2 nouveaux cours", type: "upload", target: 2, xp: 500 },
  { title: "Session de focus (15 min)", type: "focus", target: 15, xp: 100 },
  { title: "Session de focus (30 min)", type: "focus", target: 30, xp: 250 },
  { title: "Maîtrise matinale (10 flashcards)", type: "flashcards", target: 10, xp: 100 },
]

const WEEKLY_QUESTS_POOL = [
  { title: "Le Marathonien (200 flashcards)", type: "flashcards", target: 200, xp: 1500 },
  { title: "Bibliothécaire (5 nouveaux cours)", type: "upload", target: 5, xp: 1200 },
  { title: "Concentration absolue (2h de focus)", type: "focus", target: 120, xp: 1000 },
  { title: "Expert SRS (500 flashcards)", type: "flashcards", target: 500, xp: 3000 },
]

export async function initializeUserQuests(userId: string) {
  const supabase = createClient()
  const now = new Date().toISOString()

  // 1. Get current ACTIVE quests
  const { data: activeQuests } = await supabase
    .from('user_quests')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', now)

  const hasDaily = activeQuests?.some(q => !q.is_weekly) || false
  const hasWeekly = activeQuests?.some(q => q.is_weekly) || false

  const newQuests: any[] = []

  // 2. Si pas de quêtes quotidiennes, en générer 3 aléatoires
  if (!hasDaily) {
    const dailyExpires = new Date()
    dailyExpires.setHours(23, 59, 59, 999)
    
    const shuffled = [...DAILY_QUESTS_POOL].sort(() => 0.5 - Math.random())
    const selected = shuffled.slice(0, 3)
    
    selected.forEach(q => {
      newQuests.push({
        user_id: userId,
        title: q.title,
        quest_type: q.type,
        target_count: q.target,
        current_count: 0,
        xp_reward: q.xp,
        completed: false,
        is_weekly: false,
        expires_at: dailyExpires.toISOString()
      })
    })
  }

  // 3. Si pas de quêtes hebdomadaires, en générer 1 aléatoire
  if (!hasWeekly) {
    const weeklyExpires = new Date()
    // Fin de semaine (dimanche soir)
    const day = weeklyExpires.getDay()
    const diff = weeklyExpires.getDate() + (7 - day) % 7
    weeklyExpires.setDate(diff)
    weeklyExpires.setHours(23, 59, 59, 999)

    const shuffled = [...WEEKLY_QUESTS_POOL].sort(() => 0.5 - Math.random())
    const selected = shuffled.slice(0, 1)

    selected.forEach(q => {
      newQuests.push({
        user_id: userId,
        title: q.title,
        quest_type: q.type,
        target_count: q.target,
        current_count: 0,
        xp_reward: q.xp,
        completed: false,
        is_weekly: true,
        expires_at: weeklyExpires.toISOString()
      })
    })
  }

  if (newQuests.length > 0) {
    await supabase.from('user_quests').insert(newQuests)
  }
}
