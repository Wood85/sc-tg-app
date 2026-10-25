ALTER TABLE "price_items" ADD COLUMN "addon" jsonb;--> statement-breakpoint
ALTER TABLE "report_works" ADD COLUMN "addon_name_snapshot" text;--> statement-breakpoint
ALTER TABLE "report_works" ADD COLUMN "addon_qty" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "report_works" ADD COLUMN "addon_price_snapshot" integer;