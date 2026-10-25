CREATE TABLE "daily_wages" (
	"user_id" integer NOT NULL,
	"work_date" date NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_wages_user_id_work_date_pk" PRIMARY KEY("user_id","work_date")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_wages" ADD CONSTRAINT "daily_wages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;