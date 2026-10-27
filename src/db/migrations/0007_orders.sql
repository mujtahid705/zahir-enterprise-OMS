CREATE TABLE "number_sequences" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_value" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "number_sequences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"spec_text" text NOT NULL,
	"quantity" integer NOT NULL,
	"sell_price" numeric(12, 2) NOT NULL,
	"buy_price" numeric(12, 2) NOT NULL,
	"sell_total" numeric(14, 2) GENERATED ALWAYS AS (quantity * sell_price) STORED,
	"buy_total" numeric(14, 2) GENERATED ALWAYS AS (quantity * buy_price) STORED,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "order_items_order_id_product_id_unique" UNIQUE("order_id","product_id"),
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_sell_price_positive" CHECK ("order_items"."sell_price" > 0),
	CONSTRAINT "order_items_buy_price_positive" CHECK ("order_items"."buy_price" > 0)
);
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"seq" integer NOT NULL,
	"order_no" text NOT NULL,
	"challan_no" text NOT NULL,
	"invoice_no" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_address" text NOT NULL,
	"delivery_address" text NOT NULL,
	"order_date" date NOT NULL,
	"delivery_date" date,
	"customer_ref" text,
	"notes" text,
	"invoice_note" text,
	"status" "order_status" DEFAULT 'created' NOT NULL,
	"status_before_cancel" "order_status",
	"cancel_reason" text,
	"is_locked" boolean DEFAULT false NOT NULL,
	"challan_date" date,
	"invoice_date" date,
	"challan_downloaded_at" timestamp with time zone,
	"invoice_downloaded_at" timestamp with time zone,
	"challan_needs_resend" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "orders_order_no_unique" UNIQUE("order_no"),
	CONSTRAINT "orders_challan_no_unique" UNIQUE("challan_no"),
	CONSTRAINT "orders_invoice_no_unique" UNIQUE("invoice_no"),
	CONSTRAINT "orders_year_seq_unique" UNIQUE("year","seq")
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"letter" char(1) NOT NULL,
	"wo_no" text NOT NULL,
	"supplier_name" text NOT NULL,
	"supplier_phone" text NOT NULL,
	"supplier_address" text NOT NULL,
	"status" "wo_status" DEFAULT 'pending' NOT NULL,
	"needs_resend" boolean DEFAULT false NOT NULL,
	"wo_date" date,
	"note" text,
	"sent_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_acknowledged_at" timestamp with time zone,
	"cancel_acknowledged_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "work_orders_wo_no_unique" UNIQUE("wo_no"),
	CONSTRAINT "work_orders_order_id_letter_unique" UNIQUE("order_id","letter")
);
--> statement-breakpoint
ALTER TABLE "work_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_cancel_acknowledged_by_profiles_id_fk" FOREIGN KEY ("cancel_acknowledged_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_supplier_id_idx" ON "order_items" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_order_date_idx" ON "orders" USING btree ("order_date");--> statement-breakpoint
CREATE UNIQUE INDEX "work_orders_order_id_supplier_id_open_unique" ON "work_orders" USING btree ("order_id","supplier_id") WHERE "work_orders"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "work_orders_order_id_idx" ON "work_orders" USING btree ("order_id");