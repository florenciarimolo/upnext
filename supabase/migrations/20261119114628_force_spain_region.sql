-- Keep user_preferences.region on Spain and drop a recommendation pool
-- that was built for any other region.

CREATE OR REPLACE FUNCTION public.force_spain_region()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.region := 'ES';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_preferences_force_spain ON public.user_preferences;
CREATE TRIGGER user_preferences_force_spain
  BEFORE INSERT OR UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.force_spain_region();

CREATE OR REPLACE FUNCTION public.clear_pool_when_region_was_not_spain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.region IS DISTINCT FROM 'ES' THEN
    DELETE FROM public.recommendation_pool WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.force_spain_region() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_pool_when_region_was_not_spain() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_preferences_clear_non_spain_pool ON public.user_preferences;
CREATE TRIGGER user_preferences_clear_non_spain_pool
  AFTER UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_pool_when_region_was_not_spain();

UPDATE public.user_preferences
SET region = 'ES'
WHERE region IS DISTINCT FROM 'ES';
