ALTER TABLE "report_photos" DROP CONSTRAINT "report_photos_report_id_reports_id_fk";
--> statement-breakpoint
ALTER TABLE "report_photos" ALTER COLUMN "report_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "report_photos" ADD COLUMN "uploader_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "report_photos" ADD COLUMN "storage_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "report_photos" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "report_photos" ADD CONSTRAINT "report_photos_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_photos" ADD CONSTRAINT "report_photos_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_photos_report_id_index" ON "report_photos" USING btree ("report_id");