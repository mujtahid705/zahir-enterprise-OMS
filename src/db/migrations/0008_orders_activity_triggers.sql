-- Activity Log for Orders, Work Orders and Order Items (SPEC §11, ADR 0001).
-- Their labels (order_no, wo_no, product_name) and order_id are already in
-- activity_entity_label and log_row_change. number_sequences is not logged
-- (SPEC §14 Triggers).

CREATE TRIGGER log_row_change
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_row_change();--> statement-breakpoint

CREATE TRIGGER log_row_change
AFTER INSERT OR UPDATE OR DELETE ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.log_row_change();--> statement-breakpoint

CREATE TRIGGER log_row_change
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.log_row_change();--> statement-breakpoint

CREATE TRIGGER refuse_unlogged_truncate
BEFORE TRUNCATE ON public.orders
FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_unlogged_truncate();--> statement-breakpoint

CREATE TRIGGER refuse_unlogged_truncate
BEFORE TRUNCATE ON public.work_orders
FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_unlogged_truncate();--> statement-breakpoint

CREATE TRIGGER refuse_unlogged_truncate
BEFORE TRUNCATE ON public.order_items
FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_unlogged_truncate();
