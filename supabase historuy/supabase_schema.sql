-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables to start fresh (as requested)
DROP TABLE IF EXISTS user_srs CASCADE;
DROP TABLE IF EXISTS decks CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS user_stats CASCADE;
DROP TABLE IF EXISTS user_xp CASCADE;

-- 1. user_xp
CREATE TABLE user_xp (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    rank_title TEXT DEFAULT 'Recruit 🌱',
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. user_stats
CREATE TABLE user_stats (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    ai_energy INTEGER DEFAULT 40 CHECK (ai_energy >= 0 AND ai_energy <= 40),
    last_energy_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cards_reviewed INTEGER DEFAULT 0,
    decks_completed INTEGER DEFAULT 0
);

-- 3. documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content_raw TEXT,
    summary_html TEXT,
    size INTEGER,
    type TEXT,
    status TEXT DEFAULT 'processing',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. decks (needed for user_srs)
CREATE TABLE decks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. user_srs
CREATE TABLE user_srs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    ease_factor REAL DEFAULT 2.5,
    interval INTEGER DEFAULT 0,
    repetition INTEGER DEFAULT 0,
    next_review TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE user_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_srs ENABLE ROW LEVEL SECURITY;

-- Policies for user_xp
CREATE POLICY "Users can view own xp" ON user_xp FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own xp" ON user_xp FOR UPDATE USING (auth.uid() = id);

-- Policies for user_stats
CREATE POLICY "Users can view own stats" ON user_stats FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own stats" ON user_stats FOR UPDATE USING (auth.uid() = id);

-- Policies for documents
CREATE POLICY "Users can view own documents" ON documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON documents FOR DELETE USING (auth.uid() = user_id);

-- Policies for decks
CREATE POLICY "Users can view own decks" ON decks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own decks" ON decks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own decks" ON decks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own decks" ON decks FOR DELETE USING (auth.uid() = user_id);

-- Policies for user_srs
CREATE POLICY "Users can view own srs cards" ON user_srs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own srs cards" ON user_srs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own srs cards" ON user_srs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own srs cards" ON user_srs FOR DELETE USING (auth.uid() = user_id);

-- Trigger to create user profile on sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_xp (id, email)
  VALUES (new.id, new.email);
  
  INSERT INTO public.user_stats (id)
  VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset energy daily
CREATE OR REPLACE FUNCTION public.reset_daily_energy()
RETURNS void AS $$
BEGIN
  UPDATE public.user_stats
  SET ai_energy = 40,
      last_energy_reset = NOW()
  WHERE last_energy_reset < (NOW() - INTERVAL '24 hours');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: You should set up a Cron job in Supabase to call reset_daily_energy() every day at 00:00.
-- select cron.schedule('0 0 * * *', 'select reset_daily_energy()');

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
