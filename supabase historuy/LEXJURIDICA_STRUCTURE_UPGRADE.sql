-- ====================================================================
-- LEXJURIDICA — UPGRADE GAMIFICATION & GEMINI 1.5
-- Date : 28 Mars 2026
-- Description : Mise à jour de la structure pour les Séries (Streaks), 
--               Quêtes Quotidiennes et Duels IA.
-- ====================================================================

-- 1. EXTENSIONS (Si non activées)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. MISE À JOUR DE LA TABLE USER_STATS
-- Ajout des colonnes pour le suivi des séries et du focus
ALTER TABLE user_stats 
ADD COLUMN IF NOT EXISTS streak_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_streak_date DATE,
ADD COLUMN IF NOT EXISTS focus_minutes INTEGER DEFAULT 0;

-- 3. CRÉATION DE LA TABLE DES QUÊTES
-- Permet de suivre les objectifs journaliers des élèves
CREATE TABLE IF NOT EXISTS user_quests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quest_type TEXT NOT NULL, -- 'flashcards', 'upload', 'focus'
    title TEXT NOT NULL,
    target_count INTEGER NOT NULL,
    current_count INTEGER DEFAULT 0,
    xp_reward INTEGER DEFAULT 50,
    completed BOOLEAN DEFAULT FALSE,
    reset_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CRÉATION DE LA TABLE DES CHALLENGES (DUELS)
-- Stockage des scénarios de cas pratiques générés par Gemini
CREATE TABLE IF NOT EXISTS daily_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scenario TEXT NOT NULL,
    user_answer TEXT,
    score INTEGER,
    feedback TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. SÉCURITÉ RLS (Row Level Security)
ALTER TABLE user_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;

-- Politiques pour les Quêtes
DROP POLICY IF EXISTS "Users can view own quests" ON user_quests;
CREATE POLICY "Users can view own quests" ON user_quests FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own quests" ON user_quests;
CREATE POLICY "Users can update own quests" ON user_quests FOR UPDATE USING (auth.uid() = user_id);

-- Politiques pour les Challenges
DROP POLICY IF EXISTS "Users can view own challenges" ON daily_challenges;
CREATE POLICY "Users can view own challenges" ON daily_challenges FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own challenges" ON daily_challenges;
CREATE POLICY "Users can insert own challenges" ON daily_challenges FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own challenges" ON daily_challenges;
CREATE POLICY "Users can update own challenges" ON daily_challenges FOR UPDATE USING (auth.uid() = user_id);

-- 6. LOGIQUE SERVEUR (FUNCTIONS & RPC)

-- Fonction pour initialiser ou réinitialiser les quêtes d'un utilisateur
CREATE OR REPLACE FUNCTION initialize_daily_quests(uid UUID)
RETURNS void AS $$
BEGIN
    -- Nettoyage des anciennes quêtes pour éviter les doublons
    DELETE FROM user_quests WHERE user_id = uid;

    -- Insertion des 3 quêtes standards
    INSERT INTO user_quests (user_id, quest_type, title, target_count, xp_reward)
    VALUES 
    (uid, 'flashcards', 'Maître des Cartes (20 révisions)', 20, 50),
    (uid, 'upload', 'Chercheur (1 nouveau cours)', 1, 100),
    (uid, 'focus', 'Concentration (15 min focus)', 15, 30);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mise à jour du déclencheur d'inscription (Trigger)
-- Garantit que chaque nouvel élève a ses stats et ses quêtes prêtes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Création profil XP
  INSERT INTO public.user_xp (id, email) 
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  
  -- Création stats
  INSERT INTO public.user_stats (id) 
  VALUES (new.id)
  ON CONFLICT (id) DO NOTHING;

  -- Initialisation quêtes
  PERFORM initialize_daily_quests(new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ré-application du trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. LOGIQUE DE GRADES (TITRES JURIDIQUES)
CREATE OR REPLACE FUNCTION get_rank_title(lvl INTEGER) 
RETURNS TEXT AS $$
BEGIN
    IF lvl <= 5 THEN RETURN 'Stagiaire 🌱';
    ELSIF lvl <= 10 THEN RETURN 'Élève-Avocat ⚖️';
    ELSIF lvl <= 20 THEN RETURN 'Collaborateur 💼';
    ELSIF lvl <= 50 THEN RETURN 'Associé 🏛️';
    ELSE RETURN 'Bâtonnier 🎖️';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour le grade automatiquement lors d'un level up
CREATE OR REPLACE FUNCTION update_user_rank_trigger()
RETURNS trigger AS $$
BEGIN
    NEW.rank_title = get_rank_title(NEW.level);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_level_up_rank ON user_xp;
CREATE TRIGGER on_level_up_rank
    BEFORE UPDATE OF level ON user_xp
    FOR EACH ROW EXECUTE PROCEDURE update_user_rank_trigger();

-- ====================================================================
-- FIN DU SCRIPT. Copiez tout ce code et collez-le dans le SQL Editor de Supabase.
-- ====================================================================
