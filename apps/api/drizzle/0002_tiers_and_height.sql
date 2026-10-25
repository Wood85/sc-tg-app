ALTER TABLE "price_items" ADD COLUMN "tiers" jsonb;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "at_height" boolean DEFAULT false NOT NULL;