-- Activity Log triggers (SPEC §11, §14; ADR 0001).
-- Migrations that write rows must first run
--   select set_config('app.actor', 'system', true);
-- so log_row_change() accepts them as unattributed system writes.
-- A new table needs both triggers below (log_row_change and
-- refuse_unlogged_truncate) and, if its label isn't code + name, a branch in
-- activity_entity_label.

-- Human-readable record name shown in the Activity Log.
CREATE FUNCTION public.activity_entity_label(table_name text, row_data jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE table_name
    WHEN 'company_settings' THEN 'Company settings'
    WHEN 'profiles' THEN row_data ->> 'full_name'
    WHEN 'orders' THEN row_data ->> 'order_no'
    WHEN 'work_orders' THEN row_data ->> 'wo_no'
    WHEN 'order_items' THEN row_data ->> 'product_name'
    ELSE nullif(concat_ws(' ', row_data ->> 'code', row_data ->> 'name'), '')
  END
$$;--> statement-breakpoint

-- AFTER INSERT/UPDATE/DELETE on every table except activity_log and the
-- sequence tables. Writes one `data` row per changed table row, in the same
-- transaction, so a write that can't be logged fails.
CREATE FUNCTION public.log_row_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  actor_id text := nullif(current_setting('app.user_id', true), '');
  is_system boolean := current_setting('app.actor', true) IS NOT DISTINCT FROM 'system';
  old_row jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  new_row jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  row_data jsonb := coalesce(new_row, old_row);
  diff jsonb;
BEGIN
  IF actor_id IS NULL AND NOT is_system THEN
    RAISE EXCEPTION 'Write to % without a user: run it inside withUser (app.user_id), or set app.actor = ''system'' for migrations and seeds', TG_TABLE_NAME;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT coalesce(jsonb_object_agg(key, jsonb_build_object('from', old_row -> key, 'to', value)), '{}'::jsonb)
      INTO diff
      FROM jsonb_each(new_row)
     WHERE key NOT IN ('updated_at', 'updated_by')
       AND value IS DISTINCT FROM old_row -> key;
    -- updated_at / updated_by changes alone are not recorded (SPEC §11.1).
    IF diff = '{}'::jsonb THEN
      RETURN NULL;
    END IF;
  ELSE
    diff := row_data;
  END IF;

  INSERT INTO public.activity_log
    (kind, action, user_id, user_name, entity_type, entity_id, entity_label, order_id, changes)
  VALUES (
    'data',
    lower(TG_OP),
    actor_id::uuid,
    CASE WHEN actor_id IS NULL THEN 'System' ELSE current_setting('app.user_name', true) END,
    TG_TABLE_NAME,
    (row_data ->> 'id')::uuid,
    public.activity_entity_label(TG_TABLE_NAME, row_data),
    CASE WHEN TG_TABLE_NAME = 'orders' THEN row_data ->> 'id' ELSE row_data ->> 'order_id' END::uuid,
    diff
  );
  RETURN NULL;
END
$$;--> statement-breakpoint

CREATE TRIGGER log_row_change
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_row_change();--> statement-breakpoint

CREATE TRIGGER log_row_change
AFTER INSERT OR UPDATE OR DELETE ON public.company_settings
FOR EACH ROW EXECUTE FUNCTION public.log_row_change();--> statement-breakpoint

-- Row triggers don't fire on TRUNCATE, so a truncate would bypass the log.
-- A write that can't be logged fails (SPEC §11.3).
CREATE FUNCTION public.refuse_unlogged_truncate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'TRUNCATE on % cannot be logged: delete rows instead', TG_TABLE_NAME;
END
$$;--> statement-breakpoint

CREATE TRIGGER refuse_unlogged_truncate
BEFORE TRUNCATE ON public.profiles
FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_unlogged_truncate();--> statement-breakpoint

CREATE TRIGGER refuse_unlogged_truncate
BEFORE TRUNCATE ON public.company_settings
FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_unlogged_truncate();--> statement-breakpoint

-- Append-only, enforced twice (SPEC §11.3): the trigger holds even if a
-- grant is re-added, and the roles hold no UPDATE/DELETE/TRUNCATE.
CREATE FUNCTION public.activity_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'activity_log is append-only: % is not allowed', TG_OP;
END
$$;--> statement-breakpoint

CREATE TRIGGER activity_log_immutable
BEFORE UPDATE OR DELETE ON public.activity_log
FOR EACH ROW EXECUTE FUNCTION public.activity_log_immutable();--> statement-breakpoint

CREATE TRIGGER activity_log_no_truncate
BEFORE TRUNCATE ON public.activity_log
FOR EACH STATEMENT EXECUTE FUNCTION public.activity_log_immutable();--> statement-breakpoint

REVOKE UPDATE, DELETE, TRUNCATE ON public.activity_log FROM postgres, anon, authenticated, service_role;
