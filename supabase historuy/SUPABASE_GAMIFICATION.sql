-- GAMIFICATION UPGRADE FOR LEXJURIDICA

-- 1. Updates to user_stats (Streaks, Focus, Energy)
ALTER TABLE user_stats 
ADD COLUMN IF NOT EXISTS streak_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_streak_date DATE,
ADD COLUMN IF NOT EXISTS focus_minutes INTEGER DEFAULT 0;

-- 2. New Table for Daily Quests
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

-- 3. New Table for IA Challenges (Duels)
CREATE TABLE IF NOT EXISTS daily_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scenario TEXT NOT NULL,
    user_answer TEXT,
    score INTEGER, -- Score on 20
    feedback TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) for new tables
ALTER TABLE user_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quests" ON user_quests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own quests" ON user_quests FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own challenges" ON daily_challenges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own challenges" ON daily_challenges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own challenges" ON daily_challenges FOR UPDATE USING (auth.uid() = user_id);

-- Logic for Career Grades function
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

-- Trigger to update rank title on level change
CREATE OR REPLACE FUNCTION update_user_rank()
RETURNS trigger AS $$
BEGIN
    NEW.rank_title = get_rank_title(NEW.level);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_level_up ON user_xp;
CREATE TRIGGER on_level_up
    BEFORE UPDATE OF level ON user_xp
    FOR EACH ROW EXECUTE PROCEDURE update_user_rank();

-- Helper function to initialize quests for a user
CREATE OR REPLACE FUNCTION initialize_daily_quests(uid UUID)
RETURNS void AS $$
BEGIN
    -- Delete old quests if they exist (simple reset)
    DELETE FROM user_quests WHERE user_id = uid;

    INSERT INTO user_quests (user_id, quest_type, title, target_count, xp_reward)
    VALUES 
    (uid, 'flashcards', 'Maître des Cartes (20 révisions)', 20, 50),
    (uid, 'upload', 'Chercheur (1 nouveau cours)', 1, 100),
    (uid, 'focus', 'Concentration (15 min focus)', 15, 30);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
