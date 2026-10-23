CREATE TYPE "public"."activity_kind" AS ENUM('data', 'event');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('work_order', 'challan', 'invoice');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('created', 'wo_sent', 'delivered', 'invoiced', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."status_source" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'staff');--> statement-breakpoint
CREATE TYPE "public"."wo_status" AS ENUM('pending', 'sent', 'cancelled');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activity_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tx_id" bigint DEFAULT txid_current() NOT NULL,
	"kind" "activity_kind" NOT NULL,
	"action" text NOT NULL,
	"user_id" uuid,
	"user_name" text,
	"entity_type" text,
	"entity_id" uuid,
	"entity_label" text,
	"order_id" uuid,
	"changes" jsonb,
	"details" jsonb
);
--> statement-breakpoint
ALTER TABLE "activity_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"address" text,
	"phone" text,
	"email" text,
	"logo_path" text,
	"signature_path" text,
	"payment_instructions" text,
	"default_wo_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "company_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_occurred_at_idx" ON "activity_log" USING btree ("occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "activity_log_user_id_occurred_at_idx" ON "activity_log" USING btree ("user_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "activity_log_entity_idx" ON "activity_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "activity_log_order_id_idx" ON "activity_log" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "activity_log_tx_id_idx" ON "activity_log" USING btree ("tx_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_settings_singleton" ON "company_settings" USING btree ((true));