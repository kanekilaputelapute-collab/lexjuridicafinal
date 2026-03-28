-- ==========================================
-- LEXJURIDICA - UPGRADE SUPABASE DATABASE
-- ==========================================

-- 1. FIX UPLOAD (Erreur 400)
-- Permet de mettre à jour un document s'il existe déjà avec le même nom.
ALTER TABLE documents ADD CONSTRAINT unique_user_doc_title UNIQUE (user_id, title);

-- 2. FIX FOCUS TIME (Heures de focus)
-- Ajoute la colonne pour suivre le temps réel passé sur le site.
ALTER TABLE user_stats ADD COLUMN focus_minutes INTEGER DEFAULT 0;

-- 3. OPTIMISATION (Optionnel)
-- Index pour accélérer le comptage des cartes SRS.
CREATE INDEX IF NOT EXISTS idx_user_srs_user_id ON user_srs(user_id);
