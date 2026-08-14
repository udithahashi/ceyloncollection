CREATE TABLE "lead_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"full_key" text NOT NULL,
	"thumb_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"byte_size" integer NOT NULL,
	"original_name" text,
	"source_type" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"uploaded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_images_width_positive" CHECK ("lead_images"."width" > 0 and "lead_images"."height" > 0),
	CONSTRAINT "lead_images_size_positive" CHECK ("lead_images"."byte_size" > 0)
);
--> statement-breakpoint
ALTER TABLE "lead_images" ADD CONSTRAINT "lead_images_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_images" ADD CONSTRAINT "lead_images_uploaded_by_id_app_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_images_lead_idx" ON "lead_images" USING btree ("lead_id","sort_order","created_at");