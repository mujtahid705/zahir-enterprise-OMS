-- Activity Log for Customers and Suppliers (SPEC §11, ADR 0001). Their label
-- is code + name, the default in activity_entity_label. code_sequences is not
-- logged (SPEC §14 Triggers).

CREATE TRIGGER log_row_change
AFTER INSERT OR UPDATE OR DELETE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.log_row_change();--> statement-breakpoint

CREATE TRIGGER log_row_change
AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.log_row_change();--> statement-breakpoint

CREATE TRIGGER refuse_unlogged_truncate
BEFORE TRUNCATE ON public.customers
FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_unlogged_truncate();--> statement-breakpoint

CREATE TRIGGER refuse_unlogged_truncate
BEFORE TRUNCATE ON public.suppliers
FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_unlogged_truncate();
