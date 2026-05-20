-- ============================================================
-- handle_new_user トリガーをロバストに作り直す
-- 既存トリガーが auth.users INSERT 時に失敗していたため、
--  - 例外が出てもユーザー作成は止めない
--  - user_metadata.role があればそれを使用、なければ 'facility'
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  meta_role TEXT;
BEGIN
  meta_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'facility');
  IF meta_role NOT IN ('admin', 'facility_admin', 'facility') THEN
    meta_role := 'facility';
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, role)
    VALUES (NEW.id, meta_role)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: failed to insert profile for %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

ALTER FUNCTION handle_new_user() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION handle_new_user() TO supabase_auth_admin;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
