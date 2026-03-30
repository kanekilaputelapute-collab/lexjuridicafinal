-- Update handle_new_user to initialize quests
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_xp (id, email)
  VALUES (new.id, new.email);
  
  INSERT INTO public.user_stats (id)
  VALUES (new.id);

  -- Initialize quests
  PERFORM initialize_daily_quests(new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
