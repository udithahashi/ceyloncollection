CREATE TABLE "lead_intake" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"phone_raw" text,
	"customer_name_raw" text,
	"platform_raw" text,
	"message_text" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"promoted_lead_id" uuid,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_intake_status_valid" CHECK ("status" in ('pending', 'promoted', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "lead_intake" ADD CONSTRAINT "lead_intake_reviewed_by_id_app_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_intake" ADD CONSTRAINT "lead_intake_promoted_lead_id_leads_id_fk" FOREIGN KEY ("promoted_lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_intake_external_id_key" ON "lead_intake" USING btree ("external_id") WHERE "lead_intake"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "lead_intake_status_idx" ON "lead_intake" USING btree ("status","received_at");