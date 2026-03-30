-- ============================================================
-- SCRIPT DE SÉCURISATION RLS (Row Level Security)
-- ============================================================
-- À exécuter dans le SQL EDITOR de Supabase pour protéger vos données.

-- 1. TABLE DOCUMENTS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access their own documents" ON public.documents;
CREATE POLICY "Users can only access their own documents"
  ON public.documents
  FOR ALL
  USING (auth.uid() = user_id);

-- 2. TABLE DECKS (Flashcards)
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access their own decks" ON public.decks;
CREATE POLICY "Users can only access their own decks"
  ON public.decks
  FOR ALL
  USING (auth.uid() = user_id);

-- 3. TABLE USER_SRS (Cartes individuelles)
ALTER TABLE public.user_srs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access their own srs cards" ON public.user_srs;
CREATE POLICY "Users can only access their own srs cards"
  ON public.user_srs
  FOR ALL
  USING (auth.uid() = user_id);

-- 4. TABLE USER_STATS
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only see/update their own stats" ON public.user_stats;
CREATE POLICY "Users can only see/update their own stats"
  ON public.user_stats
  FOR ALL
  USING (auth.uid() = id);

-- 5. TABLE USER_XP (Leaderboard - Lecture publique permise, écriture privée)
ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can see the leaderboard" ON public.user_xp;
CREATE POLICY "Everyone can see the leaderboard"
  ON public.user_xp
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can only update their own XP" ON public.user_xp;
CREATE POLICY "Users can only update their own XP"
  ON public.user_xp
  FOR UPDATE
  USING (auth.uid() = id);

-- 6. TABLE USER_QUESTS
ALTER TABLE public.user_quests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access their own quests" ON public.user_quests;
CREATE POLICY "Users can only access their own quests"
  ON public.user_quests
  FOR ALL
  USING (auth.uid() = user_id);
