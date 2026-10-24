-- Activity Log for Products (SPEC §11, ADR 0001). Their label is code + name
-- ("P-0031 Bread poly packet"), the default in activity_entity_label.

CREATE TRIGGER log_row_change
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_row_change();--> statement-breakpoint

CREATE TRIGGER refuse_unlogged_truncate
BEFORE TRUNCATE ON public.products
FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_unlogged_truncate();
