-- Work Order letters handed out per Order, so an edit that deletes WO-…-B
-- gives the next new Supplier C, never B again (SPEC §7).
ALTER TABLE "orders" ADD COLUMN "wo_letters_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

-- Until now no Work Order was ever deleted, so the highest letter is the
-- count handed out.
SELECT set_config('app.actor', 'system', true);--> statement-breakpoint
UPDATE "orders" o
SET "wo_letters_used" = w.used
FROM (
  SELECT "order_id", max(ascii("letter")) - ascii('A') + 1 AS used
  FROM "work_orders"
  GROUP BY "order_id"
) w
WHERE w."order_id" = o."id";
